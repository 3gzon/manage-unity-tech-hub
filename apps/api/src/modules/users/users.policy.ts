import type { SystemRole } from '@unity/types';
import { SYSTEM_ROLES } from '@unity/types';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

export function isSuperAdmin(user: AuthenticatedUser) {
  return user.roles.includes('SUPER_ADMIN');
}

export function isBranchAdmin(user: AuthenticatedUser) {
  return user.roles.includes('BRANCH_ADMIN');
}

export function assertStaffAccess(user: AuthenticatedUser) {
  if (isSuperAdmin(user) || isBranchAdmin(user)) {
    return;
  }
  throw new ForbiddenException('Instructors cannot access user management');
}

export function creatableRoles(actor: AuthenticatedUser): SystemRole[] {
  if (isSuperAdmin(actor)) {
    return ['BRANCH_ADMIN', 'SUPER_ADMIN'];
  }
  if (isBranchAdmin(actor)) {
    return ['BRANCH_ADMIN'];
  }
  return [];
}

export function canMutateTarget(actor: AuthenticatedUser, targetRole: SystemRole | null) {
  if (isSuperAdmin(actor)) {
    return true;
  }
  if (isBranchAdmin(actor)) {
    return targetRole !== 'SUPER_ADMIN';
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
  return ['BRANCH_ADMIN', 'INSTRUCTOR'];
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
    throw new ForbiddenException('You cannot create a user with this role');
  }
}

export function assertCanMutate(actor: AuthenticatedUser, targetRole: SystemRole | null) {
  if (canMutateTarget(actor, targetRole)) {
    return;
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
  throw new ForbiddenException('You cannot assign this role');
}
