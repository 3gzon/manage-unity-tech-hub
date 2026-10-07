import type { PaginatedResponse } from './pagination';
import type { PaymentMethod } from './payments';

export type ExpenseCategory =
  | 'RENT'
  | 'UTILITIES'
  | 'SUPPLIES'
  | 'MARKETING'
  | 'SOFTWARE'
  | 'SALARIES'
  | 'MAINTENANCE'
  | 'OTHER';

export type ExpenseStatus = 'ACTIVE' | 'VOIDED';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'RENT',
  'UTILITIES',
  'SUPPLIES',
  'MARKETING',
  'SOFTWARE',
  'SALARIES',
  'MAINTENANCE',
  'OTHER',
];

export interface ExpenseListItem {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  paymentMethod: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
  recordedBy: string;
  recordedById: string;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
}

export type UpdateExpenseRequest = Partial<CreateExpenseRequest>;

export interface ExpenseListQuery {
  page?: number;
  pageSize?: number;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  fromDate?: string;
  toDate?: string;
}

export interface MonthlyExpenseSummary {
  month: string;
  totalAmount: string;
  expenseCount: number;
}

export type ExpenseListResponse = PaginatedResponse<ExpenseListItem>;
