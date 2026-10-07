import type { AuthUser, SystemRole } from '@unity/types';

export function hasRole(user: AuthUser | null, ...roles: SystemRole[]): boolean {
  if (!user) {
    return false;
  }
  return roles.some((role) => user.roles.includes(role));
}

export function hasPermission(user: AuthUser | null, ...permissions: string[]): boolean {
  if (!user) {
    return false;
  }

  if (user.roles.includes('SUPER_ADMIN')) {
    return true;
  }

  return permissions.every((permission) => user.permissions.includes(permission));
}

export function hasAnyPermission(user: AuthUser | null, ...permissions: string[]): boolean {
  if (!user) {
    return false;
  }

  if (user.roles.includes('SUPER_ADMIN')) {
    return true;
  }

  return permissions.some((permission) => user.permissions.includes(permission));
}

export function isSuperAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'SUPER_ADMIN');
}

export function isAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'ADMIN');
}

export function isInstructor(user: AuthUser | null): boolean {
  return hasRole(user, 'INSTRUCTOR');
}

export function isAdminPortalUser(user: AuthUser | null): boolean {
  return Boolean(user && hasRole(user, 'SUPER_ADMIN', 'ADMIN'));
}
