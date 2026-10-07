import type { SystemRole } from '@unity/types';
import { SYSTEM_ROLES } from '@unity/types';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

export function isSuperAdmin(user: AuthenticatedUser) {
  return user.roles.includes('SUPER_ADMIN');
}

export function isAdmin(user: AuthenticatedUser) {
  return user.roles.includes('ADMIN');
}

export function assertStaffAccess(user: AuthenticatedUser) {
  if (isSuperAdmin(user) || isAdmin(user)) {
    return;
  }
  throw new ForbiddenException('Instructors cannot access user management');
}

export function creatableRoles(actor: AuthenticatedUser): SystemRole[] {
  if (isSuperAdmin(actor)) {
    return [...SYSTEM_ROLES];
  }
  if (isAdmin(actor)) {
    return ['INSTRUCTOR'];
  }
  return [];
}

export function canMutateTarget(actor: AuthenticatedUser, targetRole: SystemRole | null) {
  if (isSuperAdmin(actor)) {
    return true;
  }
  if (isAdmin(actor)) {
    return targetRole === 'INSTRUCTOR';
  }
  return false;
}

export function assignableRoles(
  actor: AuthenticatedUser,
  targetRole: SystemRole | null,
): SystemRole[] {
  if (!canMutateTarget(actor, targetRole)) {
    return [];
  }
  if (isSuperAdmin(actor)) {
    return [...SYSTEM_ROLES];
  }
  return ['INSTRUCTOR'];
}

export function canAssignRole(
  actor: AuthenticatedUser,
  targetRole: SystemRole | null,
  nextRole: SystemRole,
) {
  return assignableRoles(actor, targetRole).includes(nextRole);
}

export function canManagePermissions(actor: AuthenticatedUser) {
  return isSuperAdmin(actor);
}

export function assertCanCreate(actor: AuthenticatedUser, role: SystemRole) {
  if (!creatableRoles(actor).includes(role)) {
    if (isAdmin(actor) && (role === 'SUPER_ADMIN' || role === 'ADMIN')) {
      throw new ForbiddenException(
        role === 'SUPER_ADMIN'
          ? 'Admins cannot create Super Admin users'
          : 'Admins cannot create Admin users or promote themselves',
      );
    }
    throw new ForbiddenException('You cannot create a user with this role');
  }
}

export function assertCanMutate(actor: AuthenticatedUser, targetRole: SystemRole | null) {
  if (canMutateTarget(actor, targetRole)) {
    return;
  }

  if (isAdmin(actor) && targetRole === 'SUPER_ADMIN') {
    throw new ForbiddenException('Admins cannot edit Super Admin users');
  }

  throw new ForbiddenException('You cannot manage this user');
}

export function assertCanAssignRole(
  actor: AuthenticatedUser,
  targetRole: SystemRole | null,
  nextRole: SystemRole,
) {
  if (canAssignRole(actor, targetRole, nextRole)) {
    return;
  }

  if (isAdmin(actor) && nextRole === 'SUPER_ADMIN') {
    throw new ForbiddenException('Admins cannot assign the Super Admin role');
  }

  if (isAdmin(actor) && nextRole === 'ADMIN') {
    throw new ForbiddenException('Admins cannot promote users to Admin');
  }

  throw new ForbiddenException('You cannot assign this role');
}
