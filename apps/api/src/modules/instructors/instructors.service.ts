import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  InstructorDetail,
  InstructorListItem,
  InstructorListResponse,
  InstructorLookups,
  InstructorOption,
  InstructorStudent,
} from '@unity/types';
import { Prisma, UserStatus } from '@prisma/client';
import { currentBranchId } from '../../common/branch/branch-context';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type {
  CreateInstructorDto,
  ListInstructorsQueryDto,
  UpdateInstructorDto,
} from './dto/instructor.dto';

const instructorInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, status: true, deletedAt: true } },
  primaryGroups: {
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      course: { select: { name: true } },
      enrollments: {
        where: { status: { in: ['ACTIVE', 'PENDING'] }, deletedAt: null, student: { deletedAt: null } },
        select: {
          id: true,
          status: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              parents: {
                orderBy: [{ isPrimary: 'desc' as const }],
                select: { parent: { select: { email: true, deletedAt: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' as const },
  },
} satisfies Prisma.InstructorInclude;

type InstructorRecord = Prisma.InstructorGetPayload<{ include: typeof instructorInclude }>;

@Injectable()
export class InstructorsService {
  private readonly logger = new Logger(InstructorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async findAll(query: ListInstructorsQueryDto): Promise<InstructorListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const where: Prisma.InstructorWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, instructors] = await Promise.all([
      this.prisma.instructor.count({ where }),
      this.prisma.instructor.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: instructorInclude,
      }),
    ]);

    return {
      data: instructors.map((instructor) => this.toListItem(instructor)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<InstructorDetail> {
    const instructor = await this.requireInstructor(id);
    return this.toDetail(instructor);
  }

  async findMine(user: AuthenticatedUser): Promise<InstructorDetail> {
    const instructor = await this.prisma.instructor.findFirst({
      where: { userId: user.id, deletedAt: null },
      include: instructorInclude,
    });
    if (!instructor) throw new NotFoundException('Instructor profile not found');
    return this.toDetail(instructor);
  }

  async options(): Promise<InstructorOption[]> {
    const instructors = await this.prisma.instructor.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    return instructors.map((instructor) => ({
      id: instructor.id,
      name: `${instructor.firstName} ${instructor.lastName}`.trim(),
      email: instructor.email,
    }));
  }

  async lookups(): Promise<InstructorLookups> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        instructorProfile: null,
        roles: { some: { role: { name: 'INSTRUCTOR' } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    return {
      linkableUsers: users.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
      })),
    };
  }

  async create(user: AuthenticatedUser, dto: CreateInstructorDto): Promise<InstructorDetail> {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const phone = dto.phone?.trim() || null;
    await this.assertEmailAvailable(email);

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser && !existingUser.deletedAt) {
      throw new ConflictException('A user with this email already exists');
    }

    const role = await this.prisma.role.findUnique({ where: { name: 'INSTRUCTOR' } });
    if (!role) {
      throw new BadRequestException('Instructor role is not configured');
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const branchId = currentBranchId();
    if (!branchId) {
      throw new BadRequestException('Choose a branch before adding an instructor');
    }

    let created: Awaited<ReturnType<InstructorsService['requireInstructor']>> | null = null;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const account = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                firstName,
                lastName,
                passwordHash,
                phone,
                status: UserStatus.PENDING,
                deletedAt: null,
                branchId,
              },
            })
          : await tx.user.create({
              data: {
                email,
                firstName,
                lastName,
                passwordHash,
                phone,
                status: UserStatus.PENDING,
                branchId,
              },
            });

        await tx.userRole.deleteMany({ where: { userId: account.id } });
        await tx.userRole.create({ data: { userId: account.id, roleId: role.id } });

        return tx.instructor.create({
          data: {
            branchId: currentBranchId()!,
            firstName,
            lastName,
            email,
            phone,
            bio: dto.bio?.trim() || null,
            hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
            userId: account.id,
          },
          include: instructorInclude,
        });
      });

      await this.audit.record({
        userId: user.id,
        action: 'CREATE',
        entity: 'Instructor',
        entityId: created.id,
        newValue: this.auditSnapshot(created),
      });

      if (!created.userId) {
        await this.removeUnconfirmed(created.id, null, existingUser);
        throw new BadRequestException('Instructor account was not created');
      }
      try {
        await this.auth.sendConfirmation(created.userId);
      } catch (emailError) {
        // If only the email delivery failed (e.g. SMTP not configured), keep the
        // instructor in PENDING state — an admin can resend the invitation later.
        // Roll back only for unexpected errors (database, token generation, etc.).
        const msg = emailError instanceof Error ? emailError.message : String(emailError);
        if (msg.includes('SMTP') || msg.includes('not configured') || msg.includes('could not be sent')) {
          this.logger.warn(`Instructor ${created.email} created but confirmation email not sent: ${msg}`);
        } else {
          await this.removeUnconfirmed(created.id, created.userId, existingUser);
          throw emailError;
        }
      }

      return this.toDetail(created);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  private async removeUnconfirmed(
    instructorId: string,
    userId: string | null,
    previousUser: { id: string; status: UserStatus; deletedAt: Date | null; passwordHash: string } | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.instructor.delete({ where: { id: instructorId } });
      if (!userId) return;
      await tx.accountToken.deleteMany({ where: { userId } });
      await tx.userRole.deleteMany({ where: { userId } });
      if (!previousUser) {
        await tx.user.delete({ where: { id: userId } });
        return;
      }
      await tx.user.update({
        where: { id: previousUser.id },
        data: {
          status: previousUser.status,
          deletedAt: previousUser.deletedAt,
          passwordHash: previousUser.passwordHash,
        },
      });
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateInstructorDto): Promise<InstructorDetail> {
    const current = await this.requireInstructor(id);
    const email = dto.email?.trim().toLowerCase();
    if (email && email !== current.email) {
      await this.assertEmailAvailable(email, id);
    }
    if (dto.userId !== undefined) {
      await this.assertLinkableUser(dto.userId, id);
    }

    try {
      const updated = await this.prisma.instructor.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
          ...(email ? { email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio?.trim() || null } : {}),
          ...(dto.hireDate !== undefined
            ? { hireDate: dto.hireDate ? new Date(dto.hireDate) : null }
            : {}),
          ...(dto.userId !== undefined ? { userId: dto.userId || null } : {}),
        },
        include: instructorInclude,
      });

      await this.audit.record({
        userId: user.id,
        action: 'UPDATE',
        entity: 'Instructor',
        entityId: id,
        oldValue: this.auditSnapshot(current),
        newValue: this.auditSnapshot(updated),
      });

      return this.toDetail(updated);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async archive(user: AuthenticatedUser, id: string) {
    const instructor = await this.requireInstructor(id);

    await this.prisma.$transaction(async (tx) => {
      if (instructor.userId) {
        await tx.user.update({
          where: { id: instructor.userId },
          data: { status: UserStatus.DISABLED },
        });
        await tx.refreshToken.updateMany({
          where: { userId: instructor.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.instructor.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          userId: null,
          email: `archived.${id}.${instructor.email}`,
        },
      });
    });

    await this.audit.record({
      userId: user.id,
      action: 'ARCHIVE',
      entity: 'Instructor',
      entityId: id,
    });
  }

  private async requireInstructor(id: string): Promise<InstructorRecord> {
    const instructor = await this.prisma.instructor.findFirst({
      where: { id, deletedAt: null },
      include: instructorInclude,
    });
    if (!instructor) {
      throw new NotFoundException('Instructor not found');
    }
    return instructor;
  }

  private async assertEmailAvailable(email: string, excludeId?: string) {
    const existing = await this.prisma.instructor.findFirst({
      where: { email, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An instructor with this email already exists');
    }
  }

  private async assertLinkableUser(userId: string | null | undefined, instructorId?: string) {
    if (!userId) {
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { instructorProfile: { select: { id: true, deletedAt: true } } },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const linkedId = user.instructorProfile && !user.instructorProfile.deletedAt
      ? user.instructorProfile.id
      : null;
    if (linkedId && linkedId !== instructorId) {
      throw new BadRequestException('This user is already linked to another instructor');
    }
  }

  private toListItem(instructor: InstructorRecord): InstructorListItem {
    const user =
      instructor.user && !instructor.user.deletedAt ? instructor.user : null;

    return {
      id: instructor.id,
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      name: `${instructor.firstName} ${instructor.lastName}`.trim(),
      email: instructor.email,
      phone: instructor.phone,
      bio: instructor.bio,
      hireDate: instructor.hireDate ? instructor.hireDate.toISOString().slice(0, 10) : null,
      userId: user?.id ?? null,
      userName: user ? `${user.firstName} ${user.lastName}`.trim() : null,
      userEmail: user?.email ?? null,
      accountStatus: user?.status ?? null,
      activeGroupsCount: instructor.primaryGroups.length,
      createdAt: instructor.createdAt.toISOString(),
      updatedAt: instructor.updatedAt.toISOString(),
    };
  }

  private toDetail(instructor: InstructorRecord): InstructorDetail {
    return {
      ...this.toListItem(instructor),
      groups: instructor.primaryGroups.map((group) => ({
        id: group.id,
        name: group.name,
        courseName: group.course.name,
        status: group.status,
        enrolledCount: group.enrollments.length,
      })),
      students: instructor.primaryGroups
        .flatMap((group) => group.enrollments.map((enrollment) => this.toStudent(group, enrollment)))
        .sort((a, b) => a.studentName.localeCompare(b.studentName) || a.groupName.localeCompare(b.groupName)),
    };
  }

  private toStudent(
    group: InstructorRecord['primaryGroups'][number],
    enrollment: InstructorRecord['primaryGroups'][number]['enrollments'][number],
  ): InstructorStudent {
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.student.id,
      studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
      email: contactEmail(enrollment.student),
      groupId: group.id,
      groupName: group.name,
      courseName: group.course.name,
      status: enrollment.status === 'PENDING' ? 'PENDING' : 'ACTIVE',
    };
  }

  private auditSnapshot(instructor: InstructorRecord) {
    return {
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      email: instructor.email,
      phone: instructor.phone,
      userId: instructor.userId,
    };
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('An instructor with this email already exists');
    }
  }
}

function contactEmail(student: {
  email: string | null;
  parents: Array<{ parent: { email: string | null; deletedAt: Date | null } }>;
}) {
  const own = student.email?.trim();
  if (own) return own;
  for (const link of student.parents) {
    if (link.parent.deletedAt) continue;
    const email = link.parent.email?.trim();
    if (email) return email;
  }
  return null;
}
