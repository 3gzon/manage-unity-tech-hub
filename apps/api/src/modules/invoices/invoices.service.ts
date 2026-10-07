import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  GenerateMonthlyInvoicesResponse,
  InvoiceDetail,
  InvoiceItemDto,
  InvoiceListItem,
  InvoiceListResponse,
} from '@unity/types';
import { InvoiceStatus, Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { TuitionQuoteService } from '../payments/tuition-quote.service';
import { SettingsService } from '../settings/settings.service';
import type {
  CreateInvoiceDto,
  GenerateMonthlyInvoicesDto,
  ListInvoicesQueryDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tuition: TuitionQuoteService,
    private readonly settings: SettingsService,
  ) {}

  async findAll(query: ListInvoicesQueryDto): Promise<InvoiceListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
              { billingPeriod: { contains: query.search, mode: 'insensitive' } },
              {
                student: {
                  OR: [
                    { firstName: { contains: query.search, mode: 'insensitive' } },
                    { lastName: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
              { payments: { some: { fiscalCoupon: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.InvoiceOrderByWithRelationInput = {
      [query.sortBy ?? 'issueDate']: query.sortOrder ?? 'desc',
    };

    const [total, invoices] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return {
      data: invoices.map((invoice) => this.toListItem(invoice)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<InvoiceDetail> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        student: true,
        items: true,
        payments: {
          where: { deletedAt: null },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return this.toDetail(invoice);
  }

  async create(user: AuthenticatedUser, dto: CreateInvoiceDto): Promise<InvoiceDetail> {
    if (!dto.items.length) {
      throw new BadRequestException('Invoice must contain at least one item');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertDateOrder(new Date(dto.issueDate), new Date(dto.dueDate));

    const invoice = await this.createWithUniqueNumber(dto);

    await this.audit.record({
      userId: user.id,
      action: 'INVOICE_CREATED',
      entity: 'Invoice',
      entityId: invoice.id,
      newValue: { invoiceNumber: invoice.invoiceNumber },
    });

    return this.findOne(invoice.id);
  }

  async generateMonthly(
    user: AuthenticatedUser,
    dto: GenerateMonthlyInvoicesDto,
  ): Promise<GenerateMonthlyInvoicesResponse> {
    const month = this.assertMonth(dto.month);
    const settings = await this.settings.get();
    const issueDate = `${month}-01`;
    const dueDate = `${month}-${String(settings.invoiceDueDay).padStart(2, '0')}`;
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        billingEnabled: true,
        student: { deletedAt: null },
        group: { deletedAt: null, course: { deletedAt: null } },
      },
      distinct: ['studentId'],
      select: {
        studentId: true,
        student: { select: { firstName: true, lastName: true } },
      },
    });

    const created: GenerateMonthlyInvoicesResponse['created'] = [];
    let skipped = 0;

    for (const enrollment of enrollments) {
      const existing = await this.prisma.invoice.findFirst({
        where: {
          studentId: enrollment.studentId,
          billingPeriod: month,
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const quote = await this.tuition.forStudent(enrollment.studentId);
      if (!quote.lines.length || new Prisma.Decimal(quote.grossAmount).lte(0)) {
        skipped += 1;
        continue;
      }

      const discount = new Prisma.Decimal(quote.grossAmount).minus(quote.netAmount);
      const invoice = await this.create(user, {
        studentId: enrollment.studentId,
        issueDate,
        dueDate,
        billingPeriod: month,
        discount: discount.toNumber(),
        notes: discount.gt(0) ? quote.summary : undefined,
        items: quote.lines.map((line) => ({
          description: `${line.courseName} · ${line.groupName}`,
          quantity: 1,
          unitPrice: new Prisma.Decimal(line.listPrice).toNumber(),
        })),
      });
      created.push({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        total: invoice.total,
      });
    }

    return { month, created, skipped };
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateInvoiceDto): Promise<InvoiceDetail> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cancelled invoice cannot be edited');
    }

    const subtotal = dto.items
      ? this.calculateSubtotal(dto.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })))
      : existing.subtotal;
    const discount = dto.discount !== undefined ? new Prisma.Decimal(dto.discount) : existing.discount;
    const total = subtotal.minus(discount);
    if (total.lt(0)) {
      throw new BadRequestException('Discount cannot exceed subtotal');
    }

    const status = this.resolveInvoiceStatus({
      requestedStatus: dto.status,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
      total,
      paidAmount: existing.paidAmount,
    });

    if (dto.issueDate || dto.dueDate) {
      this.assertDateOrder(
        dto.issueDate ? new Date(dto.issueDate) : existing.issueDate,
        dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          billingPeriod: dto.billingPeriod,
          discount,
          subtotal,
          total,
          remainingAmount: total.minus(existing.paidAmount).lt(0)
            ? ZERO
            : total.minus(existing.paidAmount),
          status,
          notes: dto.notes,
        },
      });

      if (dto.items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: dto.items.map((item) => ({
            invoiceId: id,
            description: item.description.trim(),
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            amount: new Prisma.Decimal(item.quantity).mul(item.unitPrice),
          })),
        });
      }
    });

    await this.audit.record({
      userId: user.id,
      action: 'INVOICE_UPDATED',
      entity: 'Invoice',
      entityId: id,
    });

    return this.findOne(id);
  }

  async cancel(user: AuthenticatedUser, id: string): Promise<InvoiceDetail> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    if (existing.status === 'PAID') {
      throw new BadRequestException('Paid invoice cannot be cancelled');
    }

    await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.audit.record({
      userId: user.id,
      action: 'INVOICE_CANCELLED',
      entity: 'Invoice',
      entityId: id,
    });

    return this.findOne(id);
  }

  async generatePdf(id: string): Promise<Buffer> {
    const [invoice, settings] = await Promise.all([this.findOne(id), this.settings.get()]);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(22).text(settings.schoolName, { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(settings.address?.trim() || settings.currency);
      doc.moveDown(1.2);

      doc.fontSize(16).text('INVOICE', { align: 'right' });
      doc.moveDown(0.8);
      doc.fontSize(10).text(`Invoice: ${invoice.invoiceNumber}`, { align: 'right' });
      doc.text(`Issue Date: ${invoice.issueDate}`, { align: 'right' });
      doc.text(`Due Date: ${invoice.dueDate}`, { align: 'right' });
      doc.text(`Billing Period: ${invoice.billingPeriod}`, { align: 'right' });

      doc.moveDown(1.2);
      doc.fontSize(11).text(`Bill To: ${invoice.studentName}`);
      doc.moveDown(0.8);

      doc.fontSize(10).text('Description', 50, doc.y, { continued: true });
      doc.text('Qty', 320, doc.y, { width: 70, align: 'right', continued: true });
      doc.text('Unit Price', 390, doc.y, { width: 90, align: 'right', continued: true });
      doc.text('Total', 480, doc.y, { width: 80, align: 'right' });
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();

      for (const item of invoice.items) {
        doc.moveDown(0.5);
        doc.text(item.description, 50, doc.y, { continued: true });
        doc.text(item.quantity, 320, doc.y, { width: 70, align: 'right', continued: true });
        doc.text(item.unitPrice, 390, doc.y, { width: 90, align: 'right', continued: true });
        doc.text(item.total, 480, doc.y, { width: 80, align: 'right' });
      }

      doc.moveDown(1);
      doc.moveTo(360, doc.y).lineTo(560, doc.y).stroke();
      doc.moveDown(0.5);
      doc.text(`Subtotal: ${invoice.subtotal}`, 360, doc.y, { width: 200, align: 'right' });
      doc.text(`Discount: ${invoice.discount}`, 360, doc.y, { width: 200, align: 'right' });
      doc.font('Helvetica-Bold').text(`Total: ${invoice.total}`, 360, doc.y, { width: 200, align: 'right' });
      doc.font('Helvetica').text(`Paid: ${invoice.paidAmount}`, 360, doc.y, { width: 200, align: 'right' });
      doc.font('Helvetica-Bold').text(`Remaining: ${invoice.remainingAmount}`, 360, doc.y, {
        width: 200,
        align: 'right',
      });
      doc.font('Helvetica');

      doc.moveDown(1);
      doc.text(`Status: ${invoice.status}`);
      if (invoice.notes) {
        doc.moveDown(0.5);
        doc.text(`Notes: ${invoice.notes}`);
      }

      doc.moveDown(2);
      doc.fontSize(9).fillColor('#666666').text(`Thank you for choosing ${settings.schoolName}.`, {
        align: 'center',
      });

      doc.end();
    });
  }

  private async createWithUniqueNumber(dto: CreateInvoiceDto) {
    const totals = this.calculateTotals(dto.items, dto.discount ?? 0);
    const issueDate = new Date(dto.issueDate);
    const dueDate = new Date(dto.dueDate);
    const year = issueDate.getFullYear();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invoiceNumber = await this.getNextInvoiceNumber(year);
      try {
        return await this.prisma.$transaction(async (tx) => {
          return await tx.invoice.create({
            data: {
              invoiceNumber,
              studentId: dto.studentId,
              issueDate,
              dueDate,
              billingPeriod: dto.billingPeriod.trim(),
              subtotal: totals.subtotal,
              discount: totals.discount,
              total: totals.total,
              paidAmount: ZERO,
              remainingAmount: totals.total,
              status: this.resolveInvoiceStatus({
                requestedStatus: dto.status,
                dueDate,
                total: totals.total,
                paidAmount: ZERO,
              }),
              notes: dto.notes,
              items: {
                create: dto.items.map((item) => ({
                  description: item.description.trim(),
                  quantity: new Prisma.Decimal(item.quantity),
                  unitPrice: new Prisma.Decimal(item.unitPrice),
                  amount: new Prisma.Decimal(item.quantity).mul(item.unitPrice),
                })),
              },
            },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException('Could not generate a unique invoice number');
  }

  private async getNextInvoiceNumber(year: number): Promise<string> {
    const prefix = `UTH-${year}-`;
    const last = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    const nextSeq = last
      ? Number(last.invoiceNumber.slice(prefix.length)) + 1
      : 1;

    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  private calculateSubtotal(
    items: Array<{ quantity: number; unitPrice: number }>,
  ): Prisma.Decimal {
    return items.reduce((sum, item) => {
      return sum.plus(new Prisma.Decimal(item.quantity).mul(item.unitPrice));
    }, ZERO);
  }

  private calculateTotals(
    items: Array<{ quantity: number; unitPrice: number }>,
    discountInput: number,
  ) {
    const subtotal = this.calculateSubtotal(items);
    const discount = new Prisma.Decimal(discountInput);
    if (discount.lt(0)) {
      throw new BadRequestException('Discount cannot be negative');
    }
    if (discount.gt(subtotal)) {
      throw new BadRequestException('Discount cannot exceed subtotal');
    }
    return {
      subtotal,
      discount,
      total: subtotal.minus(discount),
    };
  }

  private resolveInvoiceStatus(input: {
    requestedStatus?: InvoiceStatus;
    dueDate: Date;
    total: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
  }): InvoiceStatus {
    if (input.requestedStatus === 'CANCELLED' || input.requestedStatus === 'DRAFT') {
      return input.requestedStatus;
    }

    if (input.paidAmount.gte(input.total)) {
      return 'PAID';
    }

    if (input.paidAmount.gt(0)) {
      return 'PARTIALLY_PAID';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(input.dueDate);
    due.setHours(0, 0, 0, 0);

    return due < today ? 'OVERDUE' : 'UNPAID';
  }

  private assertMonth(month: string) {
    const [yearPart, monthPart] = month.split('-');
    if (!yearPart || !monthPart || yearPart.length !== 4 || monthPart.length !== 2) {
      throw new BadRequestException('Month must be in YYYY-MM format');
    }
    const year = Number.parseInt(yearPart, 10);
    const monthNumber = Number.parseInt(monthPart, 10);
    if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      throw new BadRequestException('Month must be in YYYY-MM format');
    }
    return month;
  }

  private assertDateOrder(issueDate: Date, dueDate: Date) {
    if (dueDate < issueDate) {
      throw new BadRequestException('Due date cannot be earlier than issue date');
    }
  }

  private toListItem(invoice: {
    id: string;
    invoiceNumber: string;
    studentId: string;
    billingPeriod: string;
    issueDate: Date;
    dueDate: Date;
    total: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    status: InvoiceStatus;
    student: { firstName: string; lastName: string };
  }): InvoiceListItem {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId,
      studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
      billingPeriod: invoice.billingPeriod,
      issueDate: invoice.issueDate.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      amount: this.money(invoice.total),
      paid: this.money(invoice.paidAmount),
      remaining: this.money(invoice.remainingAmount),
      status: invoice.status,
    };
  }

  private toDetail(invoice: {
    id: string;
    invoiceNumber: string;
    studentId: string;
    billingPeriod: string;
    issueDate: Date;
    dueDate: Date;
    subtotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    status: InvoiceStatus;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    student: { firstName: string; lastName: string };
    items: Array<{
      id: string;
      description: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      amount: Prisma.Decimal;
    }>;
    payments?: Array<{
      id: string;
      paymentDate: Date;
      amount: Prisma.Decimal;
      method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
      fiscalCoupon: string | null;
      status: 'ACTIVE' | 'VOIDED';
    }>;
  }): InvoiceDetail {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId,
      studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
      issueDate: invoice.issueDate.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      billingPeriod: invoice.billingPeriod,
      subtotal: this.money(invoice.subtotal),
      discount: this.money(invoice.discount),
      total: this.money(invoice.total),
      paidAmount: this.money(invoice.paidAmount),
      remainingAmount: this.money(invoice.remainingAmount),
      status: invoice.status,
      notes: invoice.notes,
      items: invoice.items.map((item): InvoiceItemDto => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity.toFixed(2),
        unitPrice: this.money(item.unitPrice),
        total: this.money(item.amount),
      })),
      payments: (invoice.payments ?? []).map((payment) => ({
        id: payment.id,
        date: payment.paymentDate.toISOString().slice(0, 10),
        amount: this.money(payment.amount),
        method: payment.method,
        fiscalCoupon: payment.fiscalCoupon,
        status: payment.status,
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  private money(value: Prisma.Decimal): string {
    return value.toFixed(2);
  }
}
