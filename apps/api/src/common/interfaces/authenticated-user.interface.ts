import type { SystemRole } from '@unity/types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: SystemRole[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: SystemRole[];
  permissions: string[];
}
