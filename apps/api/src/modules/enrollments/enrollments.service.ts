import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateEnrollmentRequest,
  EnrollmentDetail,
  EnrollmentListItem,
  EnrollmentListResponse,
  UpdateEnrollmentRequest,
} from '@unity/types';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { GroupAccessService } from '../groups/group-access.service';
import type { ListEnrollmentsQueryDto } from './dto/enrollment.dto';

const ACTIVE_STATUSES = ['ACTIVE', 'PENDING'] as const;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccessService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: ListEnrollmentsQueryDto,
  ): Promise<EnrollmentListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const accessGroupFilter = await this.access.getAccessibleGroupFilter(user);

    const groupWhere: Prisma.GroupWhereInput = {
      ...accessGroupFilter,
      ...(query.courseId ? { courseId: query.courseId } : {}),
    };

    const where: Prisma.EnrollmentWhereInput = {
      deletedAt: null,
      group: groupWhere,
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.search
        ? {
            OR: [
              { student: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { student: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { group: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.EnrollmentOrderByWithRelationInput = {
      [query.sortBy ?? 'startDate']: query.sortOrder ?? 'desc',
    };

    const [total, enrollments] = await Promise.all([
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          group: { include: { course: { select: { name: true } } } },
        },
      }),
    ]);

    return {
      data: enrollments.map((enrollment) => this.toListItem(enrollment, user)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<EnrollmentDetail> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, deletedAt: null },
      include: {
        student: true,
        group: { include: { course: true } },
        discount: true,
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    await this.access.assertCanAccessGroup(user, enrollment.groupId);
    return this.toDetail(enrollment, user);
  }

  async create(user: AuthenticatedUser, dto: CreateEnrollmentRequest) {
    this.assertCanManageEnrollments(user);
    await this.assertStudentExists(dto.studentId);
    await this.assertGroupExists(dto.groupId);
    await this.assertNoDuplicateActive(dto.studentId, dto.groupId);

    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId: dto.studentId,
        groupId: dto.groupId,
        startDate: new Date(dto.startDate),
        agreedMonthlyPrice: dto.agreedMonthlyPrice,
        discountId: dto.discountId,
        discountAmount: dto.discountAmount ?? 0,
        billingEnabled: dto.billingEnabled ?? true,
        notes: dto.notes,
        status: dto.status ?? 'ACTIVE',
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'ENROLLMENT_CREATED',
      entity: 'Enrollment',
      entityId: enrollment.id,
      newValue: { studentId: dto.studentId, groupId: dto.groupId },
    });

    return this.findOne(user, enrollment.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateEnrollmentRequest) {
    this.assertCanManageEnrollments(user);

    const existing = await this.prisma.enrollment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Enrollment not found');

    const studentId = dto.studentId ?? existing.studentId;
    const groupId = dto.groupId ?? existing.groupId;
    const nextStatus = dto.status ?? existing.status;

    if (ACTIVE_STATUSES.includes(nextStatus as (typeof ACTIVE_STATUSES)[number])) {
      await this.assertNoDuplicateActive(studentId, groupId, id);
    }

    await this.prisma.enrollment.update({
      where: { id },
      data: {
        studentId: dto.studentId,
        groupId: dto.groupId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        agreedMonthlyPrice: dto.agreedMonthlyPrice,
        discountId: dto.discountId,
        discountAmount: dto.discountAmount,
        billingEnabled: dto.billingEnabled,
        notes: dto.notes,
        status: dto.status,
      },
    });

    await this.audit.record({
      userId: user.id,
      action:
        nextStatus === 'CANCELLED' || nextStatus === 'WITHDRAWN'
          ? 'ENROLLMENT_CANCELLED'
          : 'UPDATE',
      entity: 'Enrollment',
      entityId: id,
    });

    return this.findOne(user, id);
  }

  async withdraw(user: AuthenticatedUser, id: string) {
    this.assertCanManageEnrollments(user);

    const existing = await this.prisma.enrollment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Enrollment not found');

    await this.prisma.enrollment.update({
      where: { id },
      data: {
        status: 'WITHDRAWN',
        endDate: new Date(),
        deletedAt: new Date(),
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'ENROLLMENT_CANCELLED',
      entity: 'Enrollment',
      entityId: id,
    });
  }

  private assertCanManageEnrollments(user: AuthenticatedUser) {
    if (this.access.isAdmin(user)) return;
    throw new ForbiddenException('Instructors cannot manage enrollments');
  }

  private async assertStudentExists(studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
  }

  private async assertGroupExists(groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
    });
    if (!group) throw new NotFoundException('Group not found');
  }

  private async assertNoDuplicateActive(studentId: string, groupId: string, excludeId?: string) {
    const duplicate = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        groupId,
        deletedAt: null,
        status: { in: [...ACTIVE_STATUSES] },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (duplicate) {
      throw new ConflictException('Student already has an active enrollment in this group');
    }
  }

  private toListItem(
    enrollment: {
      id: string;
      studentId: string;
      student: { firstName: string; lastName: string };
      groupId: string;
      group: { name: string; course: { name: string } };
      startDate: Date;
      endDate: Date | null;
      status: EnrollmentListItem['status'];
      agreedMonthlyPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      billingEnabled: boolean;
      notes: string | null;
    },
    user: AuthenticatedUser,
  ): EnrollmentListItem {
    return {
      id: enrollment.id,
      studentId: enrollment.studentId,
      studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      groupId: enrollment.groupId,
      groupName: enrollment.group.name,
      courseName: enrollment.group.course.name,
      startDate: enrollment.startDate.toISOString().slice(0, 10),
      endDate: enrollment.endDate?.toISOString().slice(0, 10) ?? null,
      status: enrollment.status,
      notes: enrollment.notes,
      ...(this.access.canViewFinancial(user)
        ? {
            agreedMonthlyPrice: Number(enrollment.agreedMonthlyPrice).toFixed(2),
            discountAmount: Number(enrollment.discountAmount).toFixed(2),
            billingEnabled: enrollment.billingEnabled,
          }
        : {}),
    };
  }

  private toDetail(
    enrollment: {
      id: string;
      studentId: string;
      student: { firstName: string; lastName: string };
      groupId: string;
      group: { name: string; course: { name: string } };
      startDate: Date;
      endDate: Date | null;
      status: EnrollmentDetail['status'];
      agreedMonthlyPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      billingEnabled: boolean;
      notes: string | null;
      discountId: string | null;
      discount: { name: string } | null;
      createdAt: Date;
      updatedAt: Date;
    },
    user: AuthenticatedUser,
  ): EnrollmentDetail {
    return {
      ...this.toListItem(enrollment, user),
      discountId: enrollment.discountId,
      discountName: enrollment.discount?.name ?? null,
      createdAt: enrollment.createdAt.toISOString(),
      updatedAt: enrollment.updatedAt.toISOString(),
    };
  }
}
