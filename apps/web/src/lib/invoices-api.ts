import type {
  CreateInvoiceRequest,
  GenerateMonthlyInvoicesRequest,
  GenerateMonthlyInvoicesResponse,
  InvoiceDetail,
  InvoiceListQuery,
  InvoiceListResponse,
  SendInvoiceEmailRequest,
  SendInvoiceEmailResponse,
  UpdateInvoiceRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchInvoices(query: InvoiceListQuery = {}) {
  return api.get<InvoiceListResponse>('invoices', { params: query });
}

export function fetchInvoice(id: string) {
  return api.get<InvoiceDetail>(`invoices/${id}`);
}

export function createInvoice(data: CreateInvoiceRequest) {
  return api.post<InvoiceDetail>('invoices', data);
}

export function generateMonthlyInvoices(data: GenerateMonthlyInvoicesRequest) {
  return api.post<GenerateMonthlyInvoicesResponse>('invoices/generate', data);
}

export function updateInvoice(id: string, data: UpdateInvoiceRequest) {
  return api.patch<InvoiceDetail>(`invoices/${id}`, data);
}

export function cancelInvoice(id: string) {
  return api.post<InvoiceDetail>(`invoices/${id}/cancel`);
}

export function archiveInvoice(id: string) {
  return api.delete<void>(`invoices/${id}`);
}

export function sendInvoiceEmail(id: string, data: SendInvoiceEmailRequest) {
  return api.post<SendInvoiceEmailResponse>(`invoices/${id}/email`, data);
}
