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
