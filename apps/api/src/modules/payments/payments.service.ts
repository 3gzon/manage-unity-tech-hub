import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MonthlyPaymentSummary,
  PaymentDetail,
  PaymentListItem,
  PaymentListResponse,
  StudentPaymentContext,
  TuitionQuote,
} from '@unity/types';
import { InvoiceStatus, PaymentRecordStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type {
  CreatePaymentDto,
  ListPaymentsQueryDto,
  MonthlySummaryQueryDto,
  UpdatePaymentDto,
} from './dto/payment.dto';
import { TuitionQuoteService } from './tuition-quote.service';

const ZERO = new Prisma.Decimal(0);
const TUITION_DISCOUNT_NOTE = 'Automatic tuition discount:';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tuition: TuitionQuoteService,
  ) {}

  async findAll(query: ListPaymentsQueryDto): Promise<PaymentListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.fromDate || query.toDate
        ? {
            paymentDate: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { fiscalCoupon: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              {
                student: {
                  OR: [
                    { firstName: { contains: query.search, mode: 'insensitive' } },
                    { lastName: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
              { invoice: { invoiceNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.PaymentOrderByWithRelationInput = {
      [query.sortBy ?? 'paymentDate']: query.sortOrder ?? 'desc',
    };

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          student: true,
          invoice: true,
          recordedBy: true,
        },
      }),
    ]);

    return {
      data: payments.map((payment) => this.toListItem(payment)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<PaymentDetail> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: { student: true, invoice: true, recordedBy: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.toDetail(payment);
  }

  async create(user: AuthenticatedUser, dto: CreatePaymentDto): Promise<PaymentDetail> {
    await this.assertStudentExists(dto.studentId);
    const fiscalCoupon = normalizeFiscalCoupon(dto.fiscalCoupon);
    if (fiscalCoupon && !dto.invoiceId) {
      throw new BadRequestException('Select a student invoice to link this fiscal coupon');
    }
    await this.assertUniqueFiscalCoupon(fiscalCoupon);

    let notes = dto.notes?.trim() ? dto.notes.trim() : undefined;
    if (dto.invoiceId && dto.applyTuitionDiscount) {
      const quote = await this.tuition.forStudent(dto.studentId);
      const applied = await this.applyTuitionDiscount(dto.invoiceId, dto.studentId, quote);
      const packDiscount = new Prisma.Decimal(quote.multiCourseDiscount).plus(quote.familyDiscount);
      const payingNet = new Prisma.Decimal(dto.amount).toDecimalPlaces(2).equals(new Prisma.Decimal(quote.netAmount));
      if (!notes && packDiscount.gt(0) && (applied || payingNet)) {
        notes = quote.summary;
      }
    }

    let invoiceId: string | null = null;
    if (dto.invoiceId) {
      const invoice = await this.assertInvoiceForStudent(dto.invoiceId, dto.studentId);
      if (invoice.status === 'CANCELLED') {
        throw new BadRequestException('Cannot record payment for cancelled invoice');
      }
      invoiceId = invoice.id;
      await this.assertNoOverpayment(invoice.id, new Prisma.Decimal(dto.amount));
    }

    const created = await this.prisma.payment.create({
      data: {
        studentId: dto.studentId,
        invoiceId,
        recordedById: user.id,
        amount: new Prisma.Decimal(dto.amount),
        method: dto.paymentMethod,
        paymentDate: new Date(dto.paidAt),
        fiscalCoupon,
        reference: dto.reference,
        notes,
        status: 'ACTIVE',
      },
      include: { student: true, invoice: true, recordedBy: true },
    });

    if (invoiceId) {
      await this.recalculateInvoice(invoiceId);
    }

    await this.audit.record({
      userId: user.id,
      action: 'PAYMENT_CREATED',
      entity: 'Payment',
      entityId: created.id,
      newValue: { invoiceId, amount: dto.amount },
    });

    return this.toDetail(created);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdatePaymentDto): Promise<PaymentDetail> {
    const existing = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: { invoice: true },
    });
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.status === 'VOIDED') {
      throw new BadRequestException('Voided payment cannot be updated');
    }

    const nextAmount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : existing.amount;
    if (nextAmount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const nextFiscalCoupon =
      dto.fiscalCoupon === undefined ? existing.fiscalCoupon : normalizeFiscalCoupon(dto.fiscalCoupon);
    if (nextFiscalCoupon && !(dto.invoiceId === undefined ? existing.invoiceId : dto.invoiceId)) {
      throw new BadRequestException('Select a student invoice to link this fiscal coupon');
    }
    await this.assertUniqueFiscalCoupon(nextFiscalCoupon, id);

    let nextInvoiceId = dto.invoiceId === undefined ? existing.invoiceId : dto.invoiceId ?? null;
    if (nextInvoiceId) {
      await this.assertInvoiceForStudent(nextInvoiceId, existing.studentId);
      await this.assertNoOverpayment(nextInvoiceId, nextAmount, id);
    }

    await this.prisma.payment.update({
      where: { id },
      data: {
        invoiceId: nextInvoiceId,
        amount: nextAmount,
        method: dto.paymentMethod,
        paymentDate: dto.paidAt ? new Date(dto.paidAt) : undefined,
        fiscalCoupon: nextFiscalCoupon,
        reference: dto.reference,
        notes: dto.notes,
      },
    });

    if (existing.invoiceId && existing.invoiceId !== nextInvoiceId) {
      await this.recalculateInvoice(existing.invoiceId);
    }
    if (nextInvoiceId) {
      await this.recalculateInvoice(nextInvoiceId);
    }

    await this.audit.record({
      userId: user.id,
      action: 'PAYMENT_UPDATED',
      entity: 'Payment',
      entityId: id,
    });

    return this.findOne(id);
  }

  async void(user: AuthenticatedUser, id: string): Promise<PaymentDetail> {
    const existing = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.status === 'VOIDED') return this.findOne(id);

    await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
      },
    });

    if (existing.invoiceId) {
      await this.recalculateInvoice(existing.invoiceId);
    }

    await this.audit.record({
      userId: user.id,
      action: 'PAYMENT_VOIDED',
      entity: 'Payment',
      entityId: id,
    });

    return this.findOne(id);
  }

  async getStudentContext(studentId: string): Promise<StudentPaymentContext> {
    await this.assertStudentExists(studentId);
    const unpaid = await this.prisma.invoice.findMany({
      where: {
        studentId,
        deletedAt: null,
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
    });

    const outstanding = unpaid.reduce(
      (sum, invoice) => sum.plus(invoice.remainingAmount),
      ZERO,
    );
    const tuition = await this.tuition.forStudent(studentId);

    return {
      studentId,
      outstandingBalance: outstanding.toFixed(2),
      unpaidInvoices: unpaid.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        remainingAmount: invoice.remainingAmount.toFixed(2),
        subtotal: invoice.subtotal.toFixed(2),
        discount: invoice.discount.toFixed(2),
        total: invoice.total.toFixed(2),
        status: invoice.status as 'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE',
      })),
      tuition,
    };
  }

  async getMonthlySummary(query: MonthlySummaryQueryDto): Promise<MonthlyPaymentSummary> {
    const monthInput = query.month ?? new Date().toISOString().slice(0, 7);
    const [yearPart, monthPart] = monthInput.split('-');
    if (!yearPart || !monthPart || yearPart.length !== 4 || monthPart.length !== 2) {
      throw new BadRequestException('Month must be in YYYY-MM format');
    }
    const year = Number.parseInt(yearPart, 10);
    const month = Number.parseInt(monthPart, 10);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Month must be in YYYY-MM format');
    }
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const [aggregate, count] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          paymentDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          paymentDate: { gte: from, lte: to },
        },
      }),
    ]);

    return {
      month: monthInput,
      totalAmount: (aggregate._sum.amount ?? ZERO).toFixed(2),
      paymentCount: count,
    };
  }

  private async applyTuitionDiscount(invoiceId: string, studentId: string, quote: TuitionQuote): Promise<boolean> {
    const invoice = await this.assertInvoiceForStudent(invoiceId, studentId);
    if (invoice.status === 'CANCELLED') return false;

    const subtotal = invoice.subtotal.toDecimalPlaces(2);
    const gross = new Prisma.Decimal(quote.grossAmount);
    const manual = new Prisma.Decimal(quote.manualDiscount);
    const pack = new Prisma.Decimal(quote.multiCourseDiscount).plus(quote.familyDiscount).toDecimalPlaces(2);
    const afterManual = gross.minus(manual).toDecimalPlaces(2);
    const fullPolicy = manual.plus(pack).toDecimalPlaces(2);

    let target = ZERO;
    if (subtotal.equals(gross)) target = fullPolicy;
    else if (subtotal.equals(afterManual)) target = pack;
    if (target.lte(0)) return false;
    if (target.gt(subtotal)) {
      throw new BadRequestException('Tuition discount is larger than the invoice subtotal');
    }

    const currentDiscount = invoice.discount.toDecimalPlaces(2);
    if (currentDiscount.gte(target)) return false;

    const total = subtotal.minus(target);
    if (invoice.paidAmount.gt(total)) {
      throw new BadRequestException('Tuition discount would drop the invoice below the amount already paid');
    }

    const remaining = total.minus(invoice.paidAmount);
    const noteLine = `${TUITION_DISCOUNT_NOTE} ${quote.summary}`;
    const notes = invoice.notes?.includes(TUITION_DISCOUNT_NOTE)
      ? invoice.notes
      : [invoice.notes?.trim(), noteLine].filter((part) => part).join('\n');

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        discount: target,
        total,
        remainingAmount: remaining,
        status: this.invoiceStatus(total, invoice.paidAmount, invoice.dueDate, invoice.status),
        notes,
      },
    });
    return true;
  }

  private invoiceStatus(
    total: Prisma.Decimal,
    paidAmount: Prisma.Decimal,
    dueDate: Date,
    current: InvoiceStatus,
  ): InvoiceStatus {
    if (current === 'CANCELLED') return 'CANCELLED';
    if (paidAmount.gte(total)) return 'PAID';
    if (paidAmount.gt(0)) return 'PARTIALLY_PAID';
    if (current === 'DRAFT') return 'DRAFT';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today ? 'OVERDUE' : 'UNPAID';
  }

  private async assertStudentExists(studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');
  }

  private async assertUniqueFiscalCoupon(fiscalCoupon: string | null, excludePaymentId?: string) {
    if (!fiscalCoupon) return;
    const existing = await this.prisma.payment.findFirst({
      where: {
        fiscalCoupon,
        deletedAt: null,
        ...(excludePaymentId ? { NOT: { id: excludePaymentId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('This fiscal coupon is already linked to another payment');
    }
  }

  private async assertInvoiceForStudent(invoiceId: string, studentId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, studentId, deletedAt: null },
    });
    if (!invoice) {
      throw new BadRequestException('Invoice does not belong to selected student');
    }
    return invoice;
  }

  private async assertNoOverpayment(
    invoiceId: string,
    candidateAmount: Prisma.Decimal,
    excludePaymentId?: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      select: { id: true, total: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const aggregate = await this.prisma.payment.aggregate({
      where: {
        invoiceId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(excludePaymentId ? { NOT: { id: excludePaymentId } } : {}),
      },
      _sum: { amount: true },
    });
    const alreadyPaid = aggregate._sum.amount ?? ZERO;
    if (alreadyPaid.plus(candidateAmount).gt(invoice.total)) {
      throw new BadRequestException('Payment would overpay invoice');
    }
  }

  private async recalculateInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      select: { id: true, total: true, dueDate: true, status: true },
    });
    if (!invoice || invoice.status === 'CANCELLED') return;

    const aggregate = await this.prisma.payment.aggregate({
      where: { invoiceId, deletedAt: null, status: 'ACTIVE' },
      _sum: { amount: true },
    });
    const paidAmount = aggregate._sum.amount ?? ZERO;
    const remainingRaw = invoice.total.minus(paidAmount);
    const remainingAmount = remainingRaw.lt(0) ? ZERO : remainingRaw;
    const status = this.invoiceStatus(invoice.total, paidAmount, invoice.dueDate, invoice.status);

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount, remainingAmount, status },
    });
  }

  private toListItem(payment: {
    id: string;
    paymentDate: Date;
    studentId: string;
    amount: Prisma.Decimal;
    method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
    status: PaymentRecordStatus;
    student: { firstName: string; lastName: string };
    invoice: { id: string; invoiceNumber: string } | null;
    recordedBy: { firstName: string; lastName: string };
    fiscalCoupon?: string | null;
  }): PaymentListItem {
    return {
      id: payment.id,
      date: payment.paymentDate.toISOString().slice(0, 10),
      studentId: payment.studentId,
      studentName: `${payment.student.firstName} ${payment.student.lastName}`,
      invoiceId: payment.invoice?.id ?? null,
      invoiceNumber: payment.invoice?.invoiceNumber ?? null,
      amount: payment.amount.toFixed(2),
      method: payment.method,
      fiscalCoupon: payment.fiscalCoupon ?? null,
      recordedBy: `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}`,
      status: payment.status,
    };
  }

  private toDetail(payment: {
    id: string;
    paymentDate: Date;
    studentId: string;
    amount: Prisma.Decimal;
    method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
    status: PaymentRecordStatus;
    reference: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    student: { firstName: string; lastName: string };
    invoice: { id: string; invoiceNumber: string } | null;
    recordedBy: { firstName: string; lastName: string };
    fiscalCoupon?: string | null;
  }): PaymentDetail {
    return {
      ...this.toListItem(payment),
      reference: payment.reference,
      notes: payment.notes,
      paidAt: payment.paymentDate.toISOString().slice(0, 10),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }
}

function normalizeFiscalCoupon(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
