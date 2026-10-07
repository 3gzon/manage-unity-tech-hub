export type SystemRole = 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR';

export type DatabaseStatus = 'connected' | 'disconnected';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  database: DatabaseStatus;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: SystemRole[];
  permissions: string[];
  lastLoginAt: string | null;
}

export interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export function formatPermission(resource: string, action: string): string {
  return `${resource}.${action}`;
}

export * from './pagination';
export * from './dashboard';
export * from './students';
export * from './academics';
export * from './attendance';
export * from './invoices';
export * from './payments';
export * from './settings';
export * from './compensation';
export * from './expenses';
export * from './reports';
export * from './audit';
export * from './users';
export * from './instructors';
export * from './notifications';
export * from './contracts';
