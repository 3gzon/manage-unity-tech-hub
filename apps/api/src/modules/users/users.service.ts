import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  InstructorLinkOption,
  ManagedUser,
  ManagedUserListResponse,
  PermissionDefinition,
  RolePermissionSet,
  SystemRole,
  UserAccountStatus,
  UserManagementLookups,
} from '@unity/types';
import { SYSTEM_ROLES } from '@unity/types';
import { Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type {
  CreateUserDto,
  ListUsersQueryDto,
  ResetUserPasswordDto,
  UpdateRolePermissionsDto,
  UpdateUserDto,
} from './dto/user.dto';
import {
  assertCanAssignRole,
  assertCanCreate,
  assertCanMutate,
  assertStaffAccess,
  assignableRoles,
  canManagePermissions,
  canMutateTarget,
  creatableRoles,
} from './users.policy';

const userInclude = {
  roles: { include: { role: true } },
  instructorProfile: {
    select: { id: true, firstName: true, lastName: true, deletedAt: true },
  },
} satisfies Prisma.UserInclude;

type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthenticatedUser, query: ListUsersQueryDto): Promise<ManagedUserListResponse> {
    assertStaffAccess(actor);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { roles: { some: { role: { name: query.role } } } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: userInclude,
      }),
    ]);

    return {
      data: await this.toItems(actor, users),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<ManagedUser> {
    assertStaffAccess(actor);
    const user = await this.requireUser(id);
    const [item] = await this.toItems(actor, [user]);
    if (!item) {
      throw new NotFoundException('User not found');
    }
    return item;
  }

  async lookups(actor: AuthenticatedUser): Promise<UserManagementLookups> {
    assertStaffAccess(actor);

    const [instructors, permissions] = await Promise.all([
      this.prisma.instructor.findMany({
        where: { deletedAt: null },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, email: true, userId: true },
      }),
      this.prisma.permission.findMany({
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      }),
    ]);

    return {
      roles: [...SYSTEM_ROLES],
      creatableRoles: creatableRoles(actor),
      canManagePermissions: canManagePermissions(actor),
      instructors: instructors.map(
        (instructor): InstructorLinkOption => ({
          id: instructor.id,
          name: `${instructor.firstName} ${instructor.lastName}`.trim(),
          email: instructor.email,
          linkedUserId: instructor.userId,
        }),
      ),
      permissions: permissions.map(
        (permission): PermissionDefinition => ({
          key: `${permission.resource}.${permission.action}`,
          resource: permission.resource,
          action: permission.action,
          description: permission.description,
        }),
      ),
    };
  }

  async listRoles(actor: AuthenticatedUser): Promise<RolePermissionSet[]> {
    assertStaffAccess(actor);

    const roles = await this.prisma.role.findMany({
      where: { name: { in: [...SYSTEM_ROLES] } },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });

    return SYSTEM_ROLES.map((name) => {
      const role = roles.find((entry) => entry.name === name);
      return {
        name,
        displayName: role?.displayName ?? name,
        description: role?.description ?? null,
        permissions:
          role?.permissions.map((entry) => `${entry.permission.resource}.${entry.permission.action}`) ??
          [],
        canEdit: canManagePermissions(actor) && name !== 'SUPER_ADMIN',
      };
    });
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto): Promise<ManagedUser> {
    assertStaffAccess(actor);
    assertCanCreate(actor, dto.role);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('A user with this email already exists');
    }

    const role = await this.requireRole(dto.role);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: {
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                passwordHash,
                phone: dto.phone?.trim() || null,
                status: UserStatus.ACTIVE,
                deletedAt: null,
              },
            })
          : await tx.user.create({
              data: {
                email,
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                passwordHash,
                phone: dto.phone?.trim() || null,
                status: UserStatus.ACTIVE,
              },
            });

        await tx.userRole.deleteMany({ where: { userId: user.id } });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
        await this.applyInstructorLink(tx, user.id, dto.instructorId);

        return tx.user.findFirstOrThrow({
          where: { id: user.id },
          include: userInclude,
        });
      });

      await this.audit.record({
        userId: actor.id,
        action: 'CREATE',
        entity: 'User',
        entityId: created.id,
        newValue: this.auditSnapshot(created),
      });

      const [item] = await this.toItems(actor, [created]);
      if (!item) {
        throw new NotFoundException('User not found');
      }
      return item;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto): Promise<ManagedUser> {
    assertStaffAccess(actor);
    const current = await this.requireUser(id);
    const currentRole = this.primaryRole(current);
    assertCanMutate(actor, currentRole);

    if (dto.role && dto.role !== currentRole) {
      assertCanAssignRole(actor, currentRole, dto.role);
      if (currentRole === 'SUPER_ADMIN' && dto.role !== 'SUPER_ADMIN') {
        await this.assertNotLastActiveSuperAdmin(id);
      }
    }

    const email = dto.email?.trim().toLowerCase();
    if (email && email !== current.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email, deletedAt: null, id: { not: id } },
      });
      if (taken) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
            ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
            ...(email ? { email } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          },
        });

        if (dto.role && dto.role !== currentRole) {
          const role = await tx.role.findUniqueOrThrow({ where: { name: dto.role } });
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userRole.create({ data: { userId: id, roleId: role.id } });
          await this.revokeRefreshTokens(tx, id);
        }

        if (dto.instructorId !== undefined) {
          await this.applyInstructorLink(tx, id, dto.instructorId);
        }

        return tx.user.findFirstOrThrow({
          where: { id },
          include: userInclude,
        });
      });

      const nextRole = this.primaryRole(updated);
      if (dto.role && dto.role !== currentRole) {
        await this.audit.record({
          userId: actor.id,
          action: 'ROLE_UPDATED',
          entity: 'User',
          entityId: id,
          oldValue: { role: currentRole },
          newValue: { role: nextRole },
        });
      }

      await this.audit.record({
        userId: actor.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        oldValue: this.auditSnapshot(current),
        newValue: this.auditSnapshot(updated),
      });

      const [item] = await this.toItems(actor, [updated]);
      if (!item) {
        throw new NotFoundException('User not found');
      }
      return item;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async disable(actor: AuthenticatedUser, id: string): Promise<ManagedUser> {
    return this.setStatus(actor, id, 'DISABLED');
  }

  async enable(actor: AuthenticatedUser, id: string): Promise<ManagedUser> {
    return this.setStatus(actor, id, 'ACTIVE');
  }

  async resetPassword(
    actor: AuthenticatedUser,
    id: string,
    dto: ResetUserPasswordDto,
  ): Promise<ManagedUser> {
    assertStaffAccess(actor);
    const user = await this.requireUser(id);
    const role = this.primaryRole(user);
    assertCanMutate(actor, role);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash },
      });
      await this.revokeRefreshTokens(tx, id);
    });

    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      newValue: { passwordReset: true },
    });

    return this.findOne(actor, id);
  }

  async updateRolePermissions(
    actor: AuthenticatedUser,
    roleName: string,
    dto: UpdateRolePermissionsDto,
  ): Promise<RolePermissionSet> {
    assertStaffAccess(actor);

    if (!canManagePermissions(actor)) {
      throw new ForbiddenException('Only Super Admins can manage permissions');
    }

    if (roleName === 'SUPER_ADMIN') {
      throw new ForbiddenException('Super Admin permissions cannot be modified');
    }

    if (roleName !== 'ADMIN' && roleName !== 'INSTRUCTOR') {
      throw new BadRequestException('Only the three system roles are supported');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const uniqueKeys = [...new Set(dto.permissions)];
    const permissionRecords = await this.prisma.permission.findMany();
    const permissionByKey = new Map(
      permissionRecords.map((permission) => [
        `${permission.resource}.${permission.action}`,
        permission,
      ]),
    );

    const missing = uniqueKeys.filter((key) => !permissionByKey.has(key));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown permissions: ${missing.join(', ')}`);
    }

    const oldPermissions = role.permissions.map(
      (entry) => `${entry.permission.resource}.${entry.permission.action}`,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      for (const key of uniqueKeys) {
        const permission = permissionByKey.get(key);
        if (!permission) continue;
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
    });

    await this.audit.record({
      userId: actor.id,
      action: 'PERMISSION_UPDATED',
      entity: 'Role',
      entityId: role.id,
      oldValue: { role: roleName, permissions: oldPermissions },
      newValue: { role: roleName, permissions: uniqueKeys },
    });

    const roles = await this.listRoles(actor);
    const match = roles.find((entry) => entry.name === roleName);
    if (!match) {
      throw new NotFoundException('Role not found');
    }
    return match;
  }

  private async setStatus(
    actor: AuthenticatedUser,
    id: string,
    status: UserAccountStatus,
  ): Promise<ManagedUser> {
    assertStaffAccess(actor);
    const user = await this.requireUser(id);
    const role = this.primaryRole(user);
    assertCanMutate(actor, role);

    if (status === 'DISABLED') {
      if (role === 'SUPER_ADMIN') {
        await this.assertNotLastActiveSuperAdmin(id);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id },
        data: { status },
        include: userInclude,
      });
      if (status === 'DISABLED') {
        await this.revokeRefreshTokens(tx, id);
      }
      return next;
    });

    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      oldValue: { status: user.status, role },
      newValue: { status, role },
    });

    const [item] = await this.toItems(actor, [updated]);
    if (!item) {
      throw new NotFoundException('User not found');
    }
    return item;
  }

  private async requireUser(id: string): Promise<UserRecord> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: userInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async requireRole(name: SystemRole) {
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) {
      throw new BadRequestException('Unknown role');
    }
    return role;
  }

  private async assertNotLastActiveSuperAdmin(userId: string) {
    const remaining = await this.prisma.user.count({
      where: {
        id: { not: userId },
        deletedAt: null,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { name: 'SUPER_ADMIN' } } },
      },
    });

    if (remaining === 0) {
      throw new BadRequestException('Cannot disable or demote the last active Super Admin');
    }
  }

  private async applyInstructorLink(
    tx: Prisma.TransactionClient,
    userId: string,
    instructorId: string | null | undefined,
  ) {
    if (instructorId === undefined) {
      return;
    }

    await tx.instructor.updateMany({
      where: { userId, ...(instructorId ? { id: { not: instructorId } } : {}) },
      data: { userId: null },
    });

    if (!instructorId) {
      return;
    }

    const instructor = await tx.instructor.findFirst({
      where: { id: instructorId, deletedAt: null },
    });
    if (!instructor) {
      throw new BadRequestException('Instructor not found');
    }
    if (instructor.userId && instructor.userId !== userId) {
      throw new BadRequestException('This instructor is already linked to another user');
    }

    await tx.instructor.update({
      where: { id: instructorId },
      data: { userId },
    });
  }

  private async revokeRefreshTokens(tx: Prisma.TransactionClient, userId: string) {
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async toItems(actor: AuthenticatedUser, users: UserRecord[]): Promise<ManagedUser[]> {
    const lastSuperAdminId = await this.lastActiveSuperAdminId();

    return users.map((user) => {
      const role = this.primaryRole(user);
      const status = user.status === UserStatus.DISABLED ? 'DISABLED' : 'ACTIVE';
      const mutable = canMutateTarget(actor, role);
      const isLastSuperAdmin = lastSuperAdminId === user.id && role === 'SUPER_ADMIN';
      const instructor =
        user.instructorProfile && !user.instructorProfile.deletedAt
          ? user.instructorProfile
          : null;

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: user.phone,
        role,
        status,
        instructorId: instructor?.id ?? null,
        instructorName: instructor
          ? `${instructor.firstName} ${instructor.lastName}`.trim()
          : null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        actions: {
          canUpdate: mutable,
          canDisable: mutable && status === 'ACTIVE' && !isLastSuperAdmin,
          canEnable: mutable && status === 'DISABLED',
          canResetPassword: mutable,
          assignableRoles: assignableRoles(actor, role),
        },
      };
    });
  }

  private async lastActiveSuperAdminId(): Promise<string | null> {
    const superAdmins = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { name: 'SUPER_ADMIN' } } },
      },
      select: { id: true },
    });
    return superAdmins.length === 1 ? (superAdmins[0]?.id ?? null) : null;
  }

  private primaryRole(user: UserRecord): SystemRole | null {
    const names = user.roles
      .map((entry) => entry.role.name)
      .filter((name): name is SystemRole => SYSTEM_ROLES.includes(name as SystemRole));
    return names[0] ?? null;
  }

  private auditSnapshot(user: UserRecord) {
    const instructor =
      user.instructorProfile && !user.instructorProfile.deletedAt
        ? user.instructorProfile.id
        : null;

    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      role: this.primaryRole(user),
      instructorId: instructor,
    };
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A user with this email already exists');
    }
  }
}
