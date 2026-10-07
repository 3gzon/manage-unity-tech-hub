import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  FinancialNamedAmount,
  FinancialReportPreset,
  FinancialReportResponse,
} from '@unity/types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { FinancialReportQueryDto } from './dto/financial-report.dto';

const ZERO = new Prisma.Decimal(0);

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  OTHER: 'Other',
};

const EXPENSE_LABELS: Record<string, string> = {
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  SUPPLIES: 'Supplies',
  MARKETING: 'Marketing',
  SOFTWARE: 'Software',
  SALARIES: 'Salaries',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinancialReport(query: FinancialReportQueryDto): Promise<FinancialReportResponse> {
    const { preset, from, to } = this.resolvePeriod(query);

    const paymentWhere: Prisma.PaymentWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      paymentDate: { gte: from, lte: to },
    };
    const invoiceIssuedWhere: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      status: { notIn: ['DRAFT', 'CANCELLED'] },
      issueDate: { gte: from, lte: to },
    };
    const expenseWhere: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      expenseDate: { gte: from, lte: to },
    };
    const compensationWhere: Prisma.InstructorCompensationWhereInput = {
      status: { in: ['APPROVED', 'PAID'] },
      periodStart: { lte: to },
      periodEnd: { gte: from },
    };

    const [
      paymentAggregate,
      expectedAggregate,
      outstandingAggregate,
      paidInvoiceCount,
      unpaidInvoiceCount,
      expenseAggregate,
      compensationAggregate,
      payments,
      expenses,
      outstandingInvoices,
      latestPayments,
      overdueInvoices,
    ] = await Promise.all([
      this.prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
      this.prisma.invoice.aggregate({ where: invoiceIssuedWhere, _sum: { total: true } }),
      this.prisma.invoice.aggregate({
        where: {
          deletedAt: null,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
          issueDate: { gte: from, lte: to },
        },
        _sum: { remainingAmount: true },
      }),
      this.prisma.invoice.count({
        where: { ...invoiceIssuedWhere, status: 'PAID' },
      }),
      this.prisma.invoice.count({
        where: {
          deletedAt: null,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
          issueDate: { gte: from, lte: to },
        },
      }),
      this.prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
      this.prisma.instructorCompensation.aggregate({
        where: compensationWhere,
        _sum: { finalAmount: true },
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        select: {
          id: true,
          amount: true,
          method: true,
          paymentDate: true,
          student: {
            select: {
              firstName: true,
              lastName: true,
              enrollments: {
                where: {
                  deletedAt: null,
                  status: { in: ['ACTIVE', 'PENDING', 'COMPLETED'] },
                },
                select: {
                  startDate: true,
                  endDate: true,
                  agreedMonthlyPrice: true,
                  discountAmount: true,
                  group: { select: { course: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
      }),
      this.prisma.expense.findMany({
        where: expenseWhere,
        select: { category: true, amount: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
          issueDate: { gte: from, lte: to },
        },
        select: {
          studentId: true,
          remainingAmount: true,
          student: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        include: { student: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          status: 'OVERDUE',
          dueDate: { lte: to },
        },
        orderBy: { dueDate: 'asc' },
        take: 8,
        include: { student: true },
      }),
    ]);

    const revenue = paymentAggregate._sum.amount ?? ZERO;
    const expectedRevenue = expectedAggregate._sum.total ?? ZERO;
    const outstandingBalance = outstandingAggregate._sum.remainingAmount ?? ZERO;
    const expensesTotal = expenseAggregate._sum.amount ?? ZERO;
    const compensationTotal = compensationAggregate._sum.finalAmount ?? ZERO;
    const netResult = revenue.minus(expensesTotal).minus(compensationTotal);

    return {
      preset,
      fromDate: this.toDateOnly(from),
      toDate: this.toDateOnly(to),
      metrics: {
        revenue: this.money(revenue),
        expectedRevenue: this.money(expectedRevenue),
        outstandingBalance: this.money(outstandingBalance),
        paidInvoices: paidInvoiceCount,
        unpaidInvoices: unpaidInvoiceCount,
        expenses: this.money(expensesTotal),
        instructorCompensation: this.money(compensationTotal),
        netResult: this.money(netResult),
      },
      charts: {
        monthlyRevenue: this.monthlyRevenue(payments, from, to),
        revenueByCourse: this.revenueByCourse(payments),
        outstandingBalances: this.outstandingChart(outstandingInvoices),
        paymentMethods: this.groupAmounts(
          payments.map((payment) => ({
            key: payment.method,
            label: METHOD_LABELS[payment.method] ?? payment.method,
            amount: payment.amount,
          })),
        ),
        expensesByCategory: this.groupAmounts(
          expenses.map((expense) => ({
            key: expense.category,
            label: EXPENSE_LABELS[expense.category] ?? expense.category,
            amount: expense.amount,
          })),
        ),
      },
      tables: {
        topOutstandingBalances: this.topOutstanding(outstandingInvoices),
        latestPayments: latestPayments.map((payment) => ({
          id: payment.id,
          date: this.toDateOnly(payment.paymentDate),
          studentName: `${payment.student.firstName} ${payment.student.lastName}`,
          amount: this.money(payment.amount),
          method: payment.method,
        })),
        overdueInvoices: overdueInvoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
          dueDate: this.toDateOnly(invoice.dueDate),
          remainingAmount: this.money(invoice.remainingAmount),
          status: invoice.status,
        })),
      },
    };
  }

  private resolvePeriod(query: FinancialReportQueryDto): {
    preset: FinancialReportPreset;
    from: Date;
    to: Date;
  } {
    const preset = query.preset ?? 'THIS_MONTH';
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (preset === 'THIS_MONTH') {
      return {
        preset,
        from: new Date(year, month, 1),
        to: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    }
    if (preset === 'LAST_MONTH') {
      return {
        preset,
        from: new Date(year, month - 1, 1),
        to: new Date(year, month, 0, 23, 59, 59, 999),
      };
    }
    if (preset === 'LAST_3_MONTHS') {
      return {
        preset,
        from: new Date(year, month - 2, 1),
        to: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    }

    if (!query.fromDate || !query.toDate) {
      throw new BadRequestException('Custom range requires fromDate and toDate');
    }
    const from = this.parseDate(query.fromDate, 'fromDate');
    const to = this.parseDate(query.toDate, 'toDate', true);
    if (from > to) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    return { preset, from, to };
  }

  private parseDate(value: string, field: string, endOfDay = false) {
    const [yearPart, monthPart, dayPart] = value.split('-');
    if (!yearPart || !monthPart || !dayPart) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    }
    const year = Number.parseInt(yearPart, 10);
    const month = Number.parseInt(monthPart, 10);
    const day = Number.parseInt(dayPart, 10);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    }
    if (endOfDay) return new Date(year, month - 1, day, 23, 59, 59, 999);
    return new Date(year, month - 1, day);
  }

  private monthlyRevenue(
    payments: Array<{ paymentDate: Date; amount: Prisma.Decimal }>,
    from: Date,
    to: Date,
  ): FinancialNamedAmount[] {
    const totals = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      const key = payment.paymentDate.toISOString().slice(0, 7);
      totals.set(key, (totals.get(key) ?? ZERO).plus(payment.amount));
    }

    const series: FinancialNamedAmount[] = [];
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      series.push({
        key,
        label: cursor.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        amount: this.money(totals.get(key) ?? ZERO),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return series;
  }

  private revenueByCourse(
    payments: Array<{
      amount: Prisma.Decimal;
      paymentDate: Date;
      student: {
        enrollments: Array<{
          startDate: Date;
          endDate: Date | null;
          agreedMonthlyPrice: Prisma.Decimal;
          discountAmount: Prisma.Decimal;
          group: { course: { id: string; name: string } };
        }>;
      };
    }>,
  ): FinancialNamedAmount[] {
    const rows: Array<{ key: string; label: string; amount: Prisma.Decimal }> = [];

    for (const payment of payments) {
      const matching = payment.student.enrollments.filter((enrollment) => {
        return (
          enrollment.startDate <= payment.paymentDate &&
          (!enrollment.endDate || enrollment.endDate >= payment.paymentDate)
        );
      });

      if (matching.length === 0) {
        rows.push({ key: 'unassigned', label: 'Unassigned', amount: payment.amount });
        continue;
      }

      const weights = matching.map((enrollment) => {
        const net = enrollment.agreedMonthlyPrice.minus(enrollment.discountAmount);
        return net.gt(0) ? net : ZERO;
      });
      const weightTotal = weights.reduce((sum, weight) => sum.plus(weight), ZERO);

      matching.forEach((enrollment, index) => {
        const course = enrollment.group.course;
        const weight = weights[index] ?? ZERO;
        const share = weightTotal.gt(0)
          ? payment.amount.mul(weight).div(weightTotal)
          : payment.amount.div(matching.length);
        rows.push({ key: course.id, label: course.name, amount: share });
      });
    }

    return this.groupAmounts(rows).slice(0, 8);
  }

  private outstandingChart(
    invoices: Array<{
      studentId: string;
      remainingAmount: Prisma.Decimal;
      student: { firstName: string; lastName: string };
    }>,
  ): FinancialNamedAmount[] {
    return this.topOutstanding(invoices).map((row) => ({
      key: row.studentId,
      label: row.studentName,
      amount: row.remainingAmount,
    }));
  }

  private topOutstanding(
    invoices: Array<{
      studentId: string;
      remainingAmount: Prisma.Decimal;
      student: { firstName: string; lastName: string };
    }>,
  ) {
    const byStudent = new Map<
      string,
      { studentName: string; invoiceCount: number; remainingAmount: Prisma.Decimal }
    >();

    for (const invoice of invoices) {
      const existing = byStudent.get(invoice.studentId);
      if (existing) {
        existing.invoiceCount += 1;
        existing.remainingAmount = existing.remainingAmount.plus(invoice.remainingAmount);
      } else {
        byStudent.set(invoice.studentId, {
          studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
          invoiceCount: 1,
          remainingAmount: invoice.remainingAmount,
        });
      }
    }

    return [...byStudent.entries()]
      .map(([studentId, row]) => ({
        studentId,
        studentName: row.studentName,
        invoiceCount: row.invoiceCount,
        remainingAmount: row.remainingAmount,
      }))
      .sort((left, right) => right.remainingAmount.comparedTo(left.remainingAmount))
      .slice(0, 8)
      .map((row) => ({
        ...row,
        remainingAmount: this.money(row.remainingAmount),
      }));
  }

  private groupAmounts(
    rows: Array<{ key: string; label: string; amount: Prisma.Decimal }>,
  ): FinancialNamedAmount[] {
    const totals = new Map<string, { label: string; amount: Prisma.Decimal }>();
    for (const row of rows) {
      const existing = totals.get(row.key);
      if (existing) {
        existing.amount = existing.amount.plus(row.amount);
      } else {
        totals.set(row.key, { label: row.label, amount: row.amount });
      }
    }

    return [...totals.entries()]
      .map(([key, value]) => ({ key, label: value.label, amount: value.amount }))
      .sort((left, right) => right.amount.comparedTo(left.amount))
      .map((row) => ({ ...row, amount: this.money(row.amount) }));
  }

  private money(value: Prisma.Decimal) {
    return value.toFixed(2);
  }

  private toDateOnly(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
