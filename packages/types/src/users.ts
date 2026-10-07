import type { PaginatedResponse } from './pagination';

type SystemRole = 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR';

export const SYSTEM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'] as const;

export const USER_ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export interface ManagedUserActions {
  canUpdate: boolean;
  canDisable: boolean;
  canEnable: boolean;
  canResetPassword: boolean;
  assignableRoles: SystemRole[];
}

export interface ManagedUser {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  role: SystemRole | null;
  status: UserAccountStatus;
  instructorId: string | null;
  instructorName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  actions: ManagedUserActions;
}

export interface ManagedUserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: SystemRole;
  status?: UserAccountStatus;
}

export type ManagedUserListResponse = PaginatedResponse<ManagedUser>;

export interface CreateManagedUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: SystemRole;
  instructorId?: string | null;
}

export interface UpdateManagedUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  role?: SystemRole;
  instructorId?: string | null;
}

export interface ResetManagedUserPasswordRequest {
  password: string;
}

export interface PermissionDefinition {
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RolePermissionSet {
  name: SystemRole;
  displayName: string;
  description: string | null;
  permissions: string[];
  canEdit: boolean;
}

export interface InstructorLinkOption {
  id: string;
  name: string;
  email: string;
  linkedUserId: string | null;
}

export interface UserManagementLookups {
  roles: SystemRole[];
  creatableRoles: SystemRole[];
  canManagePermissions: boolean;
  instructors: InstructorLinkOption[];
  permissions: PermissionDefinition[];
}

export interface UpdateRolePermissionsRequest {
  permissions: string[];
}
