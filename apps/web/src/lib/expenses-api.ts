import type {
  CreateExpenseRequest,
  ExpenseListItem,
  ExpenseListQuery,
  ExpenseListResponse,
  MonthlyExpenseSummary,
  UpdateExpenseRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchExpenses(query: ExpenseListQuery = {}) {
  return api.get<ExpenseListResponse>('expenses', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      category: query.category,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
    },
  });
}

export function fetchExpense(id: string) {
  return api.get<ExpenseListItem>(`expenses/${id}`);
}

export function createExpense(data: CreateExpenseRequest) {
  return api.post<ExpenseListItem>('expenses', data);
}

export function updateExpense(id: string, data: UpdateExpenseRequest) {
  return api.patch<ExpenseListItem>(`expenses/${id}`, data);
}

export function voidExpense(id: string) {
  return api.post<ExpenseListItem>(`expenses/${id}/void`);
}

export function fetchMonthlyExpenseSummary(month?: string) {
  return api.get<MonthlyExpenseSummary>('expenses/summary/monthly', {
    params: { month },
  });
}
