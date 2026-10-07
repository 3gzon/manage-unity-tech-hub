import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateGroupRequest,
  GroupDetail,
  GroupListItem,
  GroupListResponse,
  UpdateGroupRequest,
} from '@unity/types';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { ListGroupsQueryDto } from './dto/group.dto';
import { GroupAccessService } from './group-access.service';
import { formatSchedulesLabel, mapScheduleEntry } from './schedule.util';

const groupInclude = {
  course: true,
  instructor: true,
  schedules: { orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }] },
  enrollments: {
    where: { status: { in: ['ACTIVE', 'PENDING'] as const }, deletedAt: null },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.GroupInclude;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccessService,
    private readonly audit: AuditService,
  ) {}

  async findAll(user: AuthenticatedUser, query: ListGroupsQueryDto): Promise<GroupListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const accessFilter = await this.access.getAccessibleGroupFilter(user);

    const where: Prisma.GroupWhereInput = {
      ...accessFilter,
      ...(query.status ? { status: query.status } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.instructorId ? { instructorId: query.instructorId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { course: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.GroupOrderByWithRelationInput = {
      [query.sortBy ?? 'name']: query.sortOrder ?? 'asc',
    };

    const [total, groups] = await Promise.all([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          course: { select: { id: true, name: true } },
          instructor: { select: { id: true, firstName: true, lastName: true } },
          schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
          enrollments: {
            where: { status: { in: ['ACTIVE', 'PENDING'] }, deletedAt: null },
            select: { id: true },
          },
        },
      }),
    ]);

    return {
      data: groups.map((group) => this.toListItem(group)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<GroupDetail> {
    await this.access.assertCanAccessGroup(user, id);

    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
      include: groupInclude,
    });
    if (!group) throw new NotFoundException('Group not found');

    return this.toDetail(group, user);
  }

  async create(user: AuthenticatedUser, dto: CreateGroupRequest) {
    this.access.assertCanManageGroups(user);
    await this.assertInstructor(dto.instructorId);

    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          name: dto.name.trim(),
          courseId: dto.courseId,
          instructorId: dto.instructorId,
          capacity: dto.capacity,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          room: dto.room,
          status: dto.status ?? 'PLANNED',
        },
      });

      if (dto.schedules?.length) {
        await tx.groupSchedule.createMany({
          data: dto.schedules.map((schedule) => ({
            groupId: created.id,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          })),
        });
      }

      return created;
    });

    await this.audit.record({
      userId: user.id,
      action: 'CREATE',
      entity: 'Group',
      entityId: group.id,
      newValue: { name: group.name },
    });

    return this.findOne(user, group.id);
  }

  async updateSchedule(
    user: AuthenticatedUser,
    id: string,
    dto: {
      room?: string;
      schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; sessionDate?: string }>;
    },
  ) {
    await this.access.assertCanAccessGroup(user, id);
    if (
      !this.access.isAdmin(user) &&
      !user.permissions.includes('attendance.manage') &&
      !user.permissions.includes('groups.manage')
    ) {
      throw new BadRequestException('Insufficient permissions to update the group schedule');
    }

    const weeklySlots = new Map<string, { dayOfWeek: number; startTime: string; endTime: string }>();
    for (const schedule of dto.schedules) {
      const dayOfWeek = schedule.sessionDate ? dayOfWeekFromDate(schedule.sessionDate) : schedule.dayOfWeek;
      weeklySlots.set(`${dayOfWeek}|${schedule.startTime}|${schedule.endTime}`, {
        dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.room !== undefined) {
        await tx.group.update({
          where: { id },
          data: { room: dto.room || null },
        });
      }

      await tx.groupSchedule.deleteMany({ where: { groupId: id } });
      if (weeklySlots.size) {
        await tx.groupSchedule.createMany({
          data: [...weeklySlots.values()].map((schedule) => ({
            groupId: id,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          })),
        });
      }

      for (const schedule of dto.schedules) {
        if (!schedule.sessionDate) continue;
        try {
          await tx.classSession.create({
            data: {
              groupId: id,
              sessionDate: dateOnly(schedule.sessionDate),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              status: 'SCHEDULED',
            },
          });
        } catch {
          await tx.classSession.updateMany({
            where: {
              groupId: id,
              sessionDate: dateOnly(schedule.sessionDate),
              startTime: schedule.startTime,
            },
            data: { endTime: schedule.endTime },
          });
        }
      }
    });

    await this.audit.record({
      userId: user.id,
      action: 'UPDATE',
      entity: 'GroupSchedule',
      entityId: id,
    });

    return this.findOne(user, id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateGroupRequest) {
    this.access.assertCanManageGroups(user);
    await this.assertExists(id);
    if (dto.instructorId !== undefined) {
      await this.assertInstructor(dto.instructorId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          courseId: dto.courseId,
          instructorId: dto.instructorId === undefined ? undefined : dto.instructorId,
          capacity: dto.capacity,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          room: dto.room,
          status: dto.status,
        },
      });

      if (dto.schedules) {
        await tx.groupSchedule.deleteMany({ where: { groupId: id } });
        if (dto.schedules.length) {
          await tx.groupSchedule.createMany({
            data: dto.schedules.map((schedule) => ({
              groupId: id,
              dayOfWeek: schedule.dayOfWeek,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            })),
          });
        }
      }
    });

    await this.audit.record({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Group',
      entityId: id,
    });

    return this.findOne(user, id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    this.access.assertCanManageGroups(user);
    await this.assertExists(id);

    await this.prisma.group.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });

    await this.audit.record({
      userId: user.id,
      action: 'ARCHIVE',
      entity: 'Group',
      entityId: id,
    });
  }

  private async assertExists(id: string) {
    const group = await this.prisma.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) throw new NotFoundException('Group not found');
  }

  private async assertInstructor(instructorId: string | null | undefined) {
    if (!instructorId) {
      return;
    }

    const instructor = await this.prisma.instructor.findFirst({
      where: { id: instructorId, deletedAt: null },
      select: { id: true },
    });
    if (!instructor) {
      throw new BadRequestException('Instructor not found');
    }
  }

  private toListItem(group: {
    id: string;
    name: string;
    courseId: string;
    course: { name: string };
    instructorId: string | null;
    instructor: { firstName: string; lastName: string } | null;
    capacity: number | null;
    startDate: Date | null;
    endDate: Date | null;
    room: string | null;
    status: GroupListItem['status'];
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
    enrollments: Array<{ id: string }>;
  }): GroupListItem {
    return {
      id: group.id,
      name: group.name,
      courseId: group.courseId,
      courseName: group.course.name,
      instructorId: group.instructorId,
      instructorName: group.instructor
        ? `${group.instructor.firstName} ${group.instructor.lastName}`
        : null,
      capacity: group.capacity,
      enrolledCount: group.enrollments.length,
      startDate: group.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: group.endDate?.toISOString().slice(0, 10) ?? null,
      room: group.room,
      status: group.status,
      scheduleSummary: formatSchedulesLabel(group.schedules),
    };
  }

  private toDetail(
    group: Prisma.GroupGetPayload<{ include: typeof groupInclude }>,
    user: AuthenticatedUser,
  ): GroupDetail {
    const detail: GroupDetail = {
      id: group.id,
      name: group.name,
      courseId: group.courseId,
      courseName: group.course.name,
      instructorId: group.instructorId,
      instructorName: group.instructor
        ? `${group.instructor.firstName} ${group.instructor.lastName}`
        : null,
      capacity: group.capacity,
      enrolledCount: group.enrollments.length,
      startDate: group.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: group.endDate?.toISOString().slice(0, 10) ?? null,
      room: group.room,
      status: group.status,
      schedules: group.schedules.map(mapScheduleEntry),
      course: {
        id: group.course.id,
        code: group.course.code,
        name: group.course.name,
        description: group.course.description,
        category: group.course.category,
        ageMin: group.course.ageMin,
        ageMax: group.course.ageMax,
        durationMonths: group.course.durationMonths,
        defaultMonthlyPrice: group.course.defaultMonthlyPrice
          ? Number(group.course.defaultMonthlyPrice).toFixed(2)
          : null,
        status: group.course.status,
        createdAt: group.course.createdAt.toISOString(),
        updatedAt: group.course.updatedAt.toISOString(),
      },
      enrollments: group.enrollments.map((enrollment) => ({
        id: enrollment.id,
        studentId: enrollment.studentId,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        groupId: group.id,
        groupName: group.name,
        courseName: group.course.name,
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
      })),
    };

    if (this.access.canViewFinancial(user)) {
      const active = group.enrollments.filter((e) => e.status === 'ACTIVE');
      const totalMonthlyRevenue = active.reduce(
        (sum, e) => sum + Number(e.agreedMonthlyPrice) - Number(e.discountAmount),
        0,
      );
      detail.financialSummary = {
        totalMonthlyRevenue: totalMonthlyRevenue.toFixed(2),
        activeEnrollments: active.length,
        billingEnabledCount: active.filter((e) => e.billingEnabled).length,
      };
    }

    return detail;
  }
}

function dayOfWeekFromDate(value: string): number {
  return dateOnly(value).getUTCDay();
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
