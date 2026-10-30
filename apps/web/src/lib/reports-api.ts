import type { FinancialReportQuery, FinancialReportResponse } from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchFinancialReport(query: FinancialReportQuery = {}) {
  return api.get<FinancialReportResponse>('reports/financial', {
    params: {
      preset: query.preset,
      fromDate: query.fromDate,
      toDate: query.toDate,
    },
  });
}

export function sendFinancialReportEmail(query: FinancialReportQuery, email: string) {
  return api.post<{ sentTo: string; detail: string }>('reports/financial/email', {
    preset: query.preset,
    fromDate: query.fromDate,
    toDate: query.toDate,
    email,
  });
}
