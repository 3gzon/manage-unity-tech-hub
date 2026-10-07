import type { PaginatedResponse } from './pagination';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type PaymentStatus = 'ACTIVE' | 'VOIDED';

export interface PaymentListItem {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: string;
  method: PaymentMethod;
  fiscalCoupon: string | null;
  recordedBy: string;
  status: PaymentStatus;
}

export interface PaymentDetail extends PaymentListItem {
  reference: string | null;
  notes: string | null;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TuitionDiscountLine {
  enrollmentId: string;
  courseId: string;
  courseName: string;
  groupName: string;
  listPrice: string;
  manualDiscount: string;
  multiCourseDiscount: string;
  isExtraCourse: boolean;
}

export interface TuitionQuote {
  courseCount: number;
  familyPack: boolean;
  familyStudentNames: string[];
  grossAmount: string;
  manualDiscount: string;
  multiCourseDiscount: string;
  familyDiscount: string;
  netAmount: string;
  multiCourseRate: string;
  familyRate: string;
  lines: TuitionDiscountLine[];
  summary: string;
}

export interface StudentPaymentContext {
  studentId: string;
  outstandingBalance: string;
  unpaidInvoices: Array<{
    id: string;
    invoiceNumber: string;
    dueDate: string;
    remainingAmount: string;
    subtotal: string;
    discount: string;
    total: string;
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE';
  }>;
  tuition: TuitionQuote;
}

export interface CreatePaymentRequest {
  studentId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAt: string;
  fiscalCoupon?: string;
  reference?: string;
  notes?: string;
  applyTuitionDiscount?: boolean;
}

export interface UpdatePaymentRequest {
  invoiceId?: string;
  amount?: number;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  fiscalCoupon?: string;
  reference?: string;
  notes?: string;
}

export interface PaymentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  studentId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'paymentDate' | 'amount' | 'method' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface MonthlyPaymentSummary {
  month: string;
  totalAmount: string;
  paymentCount: number;
}

export type PaymentListResponse = PaginatedResponse<PaymentListItem>;
