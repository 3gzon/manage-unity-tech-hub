import type {
  CreatePaymentRequest,
  MonthlyPaymentSummary,
  PaymentDetail,
  PaymentListQuery,
  PaymentListResponse,
  StudentPaymentContext,
  UpdatePaymentRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchPayments(query: PaymentListQuery = {}) {
  return api.get<PaymentListResponse>('payments', { params: query });
}

export function fetchPayment(id: string) {
  return api.get<PaymentDetail>(`payments/${id}`);
}

export function createPayment(data: CreatePaymentRequest) {
  return api.post<PaymentDetail>('payments', data);
}

export function updatePayment(id: string, data: UpdatePaymentRequest) {
  return api.patch<PaymentDetail>(`payments/${id}`, data);
}

export function voidPayment(id: string) {
  return api.post<PaymentDetail>(`payments/${id}/void`);
}

export function fetchStudentPaymentContext(studentId: string) {
  return api.get<StudentPaymentContext>(`payments/student/${studentId}/context`);
}

export function fetchMonthlyPaymentSummary(month?: string) {
  return api.get<MonthlyPaymentSummary>('payments/summary/monthly', {
    params: { month },
  });
}
