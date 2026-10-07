import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  InstructorDetail,
  InstructorListItem,
  InstructorListResponse,
  InstructorLookups,
  InstructorOption,
} from '@unity/types';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type {
  CreateInstructorDto,
  ListInstructorsQueryDto,
  UpdateInstructorDto,
} from './dto/instructor.dto';

const instructorInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, deletedAt: true } },
  primaryGroups: {
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      course: { select: { name: true } },
      enrollments: {
        where: { status: { in: ['ACTIVE', 'PENDING'] }, deletedAt: null },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' as const },
  },
} satisfies Prisma.InstructorInclude;

type InstructorRecord = Prisma.InstructorGetPayload<{ include: typeof instructorInclude }>;

@Injectable()
export class InstructorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
    await this.assertEmailAvailable(email);
    await this.assertLinkableUser(dto.userId);

    try {
      const created = await this.prisma.instructor.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email,
          phone: dto.phone?.trim() || null,
          bio: dto.bio?.trim() || null,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
          userId: dto.userId || null,
        },
        include: instructorInclude,
      });

      await this.audit.record({
        userId: user.id,
        action: 'CREATE',
        entity: 'Instructor',
        entityId: created.id,
        newValue: this.auditSnapshot(created),
      });

      return this.toDetail(created);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
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

    await this.prisma.instructor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        userId: null,
        email: `archived.${id}.${instructor.email}`,
      },
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
