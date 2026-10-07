import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ExpenseListItem,
  ExpenseListResponse,
  MonthlyExpenseSummary,
} from '@unity/types';
import { ExpenseStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type {
  CreateExpenseDto,
  ListExpensesQueryDto,
  MonthlyExpenseSummaryQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';

const ZERO = new Prisma.Decimal(0);

type ExpenseRecord = Prisma.ExpenseGetPayload<{ include: { recordedBy: true } }>;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: ListExpensesQueryDto): Promise<ExpenseListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.fromDate || query.toDate
        ? {
            expenseDate: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
    };

    const [total, expenses] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { recordedBy: true },
      }),
    ]);

    return {
      data: expenses.map((expense) => this.toItem(expense)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<ExpenseListItem> {
    const expense = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: { recordedBy: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return this.toItem(expense);
  }

  async create(user: AuthenticatedUser, dto: CreateExpenseDto): Promise<ExpenseListItem> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const created = await this.prisma.expense.create({
      data: {
        recordedById: user.id,
        category: dto.category,
        description: dto.description.trim(),
        amount,
        expenseDate: new Date(dto.expenseDate),
        paymentMethod: dto.paymentMethod,
        reference: dto.reference?.trim() || undefined,
        notes: dto.notes?.trim() || undefined,
        status: 'ACTIVE',
      },
      include: { recordedBy: true },
    });

    await this.audit.record({
      userId: user.id,
      action: 'CREATE',
      entity: 'Expense',
      entityId: created.id,
      newValue: {
        category: created.category,
        amount: created.amount.toFixed(2),
        expenseDate: created.expenseDate.toISOString().slice(0, 10),
      },
    });

    return this.toItem(created);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateExpenseDto): Promise<ExpenseListItem> {
    const existing = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    if (existing.status === 'VOIDED') {
      throw new BadRequestException('Voided expense cannot be updated');
    }

    const nextAmount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : existing.amount;
    if (nextAmount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category,
        description: dto.description?.trim(),
        amount: nextAmount,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference?.trim(),
        notes: dto.notes?.trim(),
      },
      include: { recordedBy: true },
    });

    await this.audit.record({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Expense',
      entityId: id,
      oldValue: {
        category: existing.category,
        amount: existing.amount.toFixed(2),
        expenseDate: existing.expenseDate.toISOString().slice(0, 10),
        description: existing.description,
      },
      newValue: {
        category: updated.category,
        amount: updated.amount.toFixed(2),
        expenseDate: updated.expenseDate.toISOString().slice(0, 10),
        description: updated.description,
      },
    });

    return this.toItem(updated);
  }

  async void(user: AuthenticatedUser, id: string): Promise<ExpenseListItem> {
    const existing = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    if (existing.status === 'VOIDED') return this.findOne(id);

    const voided = await this.prisma.expense.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
      },
      include: { recordedBy: true },
    });

    await this.audit.record({
      userId: user.id,
      action: 'EXPENSE_VOIDED',
      entity: 'Expense',
      entityId: id,
      oldValue: { status: existing.status, amount: existing.amount.toFixed(2) },
      newValue: { status: voided.status },
    });

    return this.toItem(voided);
  }

  async getMonthlySummary(query: MonthlyExpenseSummaryQueryDto): Promise<MonthlyExpenseSummary> {
    const { from, to, month } = this.parseMonth(query.month);
    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      status: ExpenseStatus.ACTIVE,
      expenseDate: { gte: from, lte: to },
    };

    const [aggregate, count] = await Promise.all([
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      month,
      totalAmount: (aggregate._sum.amount ?? ZERO).toFixed(2),
      expenseCount: count,
    };
  }

  private parseMonth(monthInput?: string) {
    const value = monthInput ?? new Date().toISOString().slice(0, 7);
    const [yearPart, monthPart] = value.split('-');
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
    return { from, to, month: `${yearPart}-${monthPart}` };
  }

  private toItem(expense: ExpenseRecord): ExpenseListItem {
    return {
      id: expense.id,
      date: expense.expenseDate.toISOString().slice(0, 10),
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toFixed(2),
      paymentMethod: expense.paymentMethod,
      reference: expense.reference,
      notes: expense.notes,
      recordedBy: `${expense.recordedBy.firstName} ${expense.recordedBy.lastName}`,
      recordedById: expense.recordedById,
      status: expense.status,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }
}
