import type { PaginatedResponse } from './pagination';

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'ARCHIVE',
  'LOGIN',
  'LOGOUT',
  'STUDENT_CREATED',
  'STUDENT_UPDATED',
  'STUDENT_ARCHIVED',
  'ENROLLMENT_CREATED',
  'ENROLLMENT_CANCELLED',
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_VOIDED',
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
  'INVOICE_CANCELLED',
  'ATTENDANCE_CREATED',
  'ATTENDANCE_UPDATED',
  'ROLE_UPDATED',
  'PERMISSION_UPDATED',
  'COMPENSATION_CREATED',
  'COMPENSATION_UPDATED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogListQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  entity?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AuditLogLookups {
  users: Array<{ id: string; name: string; email: string }>;
  actions: string[];
  entities: string[];
}

export type AuditLogListResponse = PaginatedResponse<AuditLogItem>;
