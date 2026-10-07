export type FinancialReportPreset = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'CUSTOM';

export interface FinancialReportQuery {
  preset?: FinancialReportPreset;
  fromDate?: string;
  toDate?: string;
}

export interface FinancialNamedAmount {
  key: string;
  label: string;
  amount: string;
}

export interface FinancialOutstandingRow {
  studentId: string;
  studentName: string;
  invoiceCount: number;
  remainingAmount: string;
}

export interface FinancialPaymentRow {
  id: string;
  date: string;
  studentName: string;
  amount: string;
  method: string;
}

export interface FinancialOverdueInvoiceRow {
  id: string;
  invoiceNumber: string;
  studentName: string;
  dueDate: string;
  remainingAmount: string;
  status: string;
}

export interface FinancialReportMetrics {
  revenue: string;
  expectedRevenue: string;
  outstandingBalance: string;
  paidInvoices: number;
  unpaidInvoices: number;
  expenses: string;
  instructorCompensation: string;
  netResult: string;
}

export interface FinancialReportCharts {
  monthlyRevenue: FinancialNamedAmount[];
  revenueByCourse: FinancialNamedAmount[];
  outstandingBalances: FinancialNamedAmount[];
  paymentMethods: FinancialNamedAmount[];
  expensesByCategory: FinancialNamedAmount[];
}

export interface FinancialReportTables {
  topOutstandingBalances: FinancialOutstandingRow[];
  latestPayments: FinancialPaymentRow[];
  overdueInvoices: FinancialOverdueInvoiceRow[];
}

export interface FinancialReportResponse {
  preset: FinancialReportPreset;
  fromDate: string;
  toDate: string;
  metrics: FinancialReportMetrics;
  charts: FinancialReportCharts;
  tables: FinancialReportTables;
}
