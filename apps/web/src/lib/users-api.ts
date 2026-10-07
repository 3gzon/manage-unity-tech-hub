import type {
  CreateManagedUserRequest,
  ManagedUser,
  ManagedUserListQuery,
  ManagedUserListResponse,
  ResetManagedUserPasswordRequest,
  RolePermissionSet,
  UpdateManagedUserRequest,
  UpdateRolePermissionsRequest,
  UserManagementLookups,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchUsers(query: ManagedUserListQuery = {}) {
  return api.get<ManagedUserListResponse>('users', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      role: query.role,
      status: query.status,
    },
  });
}

export function fetchUser(id: string) {
  return api.get<ManagedUser>(`users/${id}`);
}

export function fetchUserLookups() {
  return api.get<UserManagementLookups>('users/lookups');
}

export function fetchUserRoles() {
  return api.get<RolePermissionSet[]>('users/roles');
}

export function createUser(data: CreateManagedUserRequest) {
  return api.post<ManagedUser>('users', data);
}

export function updateUser(id: string, data: UpdateManagedUserRequest) {
  return api.patch<ManagedUser>(`users/${id}`, data);
}

export function disableUser(id: string) {
  return api.post<ManagedUser>(`users/${id}/disable`);
}

export function enableUser(id: string) {
  return api.post<ManagedUser>(`users/${id}/enable`);
}

export function resetUserPassword(id: string, data: ResetManagedUserPasswordRequest) {
  return api.post<ManagedUser>(`users/${id}/reset-password`, data);
}

export function updateRolePermissions(roleName: string, data: UpdateRolePermissionsRequest) {
  return api.patch<RolePermissionSet>(`users/roles/${roleName}/permissions`, data);
}
