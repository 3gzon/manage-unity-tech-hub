import type { PaginatedResponse } from './pagination';

export type InvoiceStatus =
  | 'DRAFT'
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  billingPeriod: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  paid: string;
  remaining: string;
  status: InvoiceStatus;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  issueDate: string;
  dueDate: string;
  billingPeriod: string;
  subtotal: string;
  discount: string;
  total: string;
  paidAmount: string;
  remainingAmount: string;
  status: InvoiceStatus;
  notes: string | null;
  items: InvoiceItemDto[];
  payments: InvoicePaymentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePaymentItem {
  id: string;
  date: string;
  amount: string;
  method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
  fiscalCoupon: string | null;
  status: 'ACTIVE' | 'VOIDED';
}

export interface GenerateMonthlyInvoicesRequest {
  month: string;
}

export interface GeneratedInvoiceSummary {
  id: string;
  invoiceNumber: string;
  studentName: string;
  total: string;
}

export interface GenerateMonthlyInvoicesResponse {
  month: string;
  created: GeneratedInvoiceSummary[];
  skipped: number;
}

export interface CreateInvoiceRequest {
  studentId: string;
  issueDate: string;
  dueDate: string;
  billingPeriod: string;
  discount?: number;
  notes?: string;
  items: InvoiceItemInput[];
  status?: InvoiceStatus;
}

export type UpdateInvoiceRequest = Partial<CreateInvoiceRequest> & {
  status?: InvoiceStatus;
};

export interface RecordInvoicePaymentRequest {
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
  paymentDate: string;
  reference?: string;
  notes?: string;
}

export interface InvoiceListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  studentId?: string;
  status?: InvoiceStatus;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: 'invoiceNumber' | 'issueDate' | 'dueDate' | 'status' | 'total';
  sortOrder?: 'asc' | 'desc';
}

export type InvoiceListResponse = PaginatedResponse<InvoiceListItem>;
