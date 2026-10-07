import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ClassSessionDetail,
  ClassSessionListItem,
  ClassSessionListResponse,
  GenerateSessionsResponse,
  InstructorScheduleResponse,
  TodayClassItem,
} from '@unity/types';
import { Prisma, ClassSessionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { GroupAccessService } from '../groups/group-access.service';
import { formatSchedulesLabel } from '../groups/schedule.util';
import type {
  CreateClassSessionDto,
  ListGroupSessionsQueryDto,
  ListScheduleQueryDto,
  ListTodaySessionsQueryDto,
} from './dto/attendance.dto';
import { SessionGeneratorService } from './session-generator.service';
import { toApiSessionStatus } from './session.util';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccessService,
    private readonly generator: SessionGeneratorService,
    private readonly audit: AuditService,
  ) {}

  async listGroupSessions(
    user: AuthenticatedUser,
    groupId: string,
    query: ListGroupSessionsQueryDto,
  ): Promise<ClassSessionListResponse> {
    await this.access.assertCanAccessGroup(user, groupId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ClassSessionWhereInput = {
      groupId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.fromDate || query.toDate
        ? {
            sessionDate: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
    };

    const [total, sessions] = await Promise.all([
      this.prisma.classSession.count({ where }),
      this.prisma.classSession.findMany({
        where,
        orderBy: [{ sessionDate: 'desc' }, { startTime: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          group: { include: { course: true, enrollments: { where: { status: 'ACTIVE', deletedAt: null } } } },
          attendances: true,
        },
      }),
    ]);

    return {
      data: sessions.map((session) => this.toListItem(session)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async createGroupSession(
    user: AuthenticatedUser,
    groupId: string,
    dto: CreateClassSessionDto,
  ): Promise<ClassSessionDetail | GenerateSessionsResponse> {
    await this.access.assertCanAccessGroup(user, groupId);
    if (!this.access.isAdmin(user)) {
      throw new ForbiddenException('Only administrators can create sessions manually');
    }

    if (dto.generateFromSchedule || (dto.fromDate && dto.toDate)) {
      if (!dto.fromDate || !dto.toDate) {
        throw new BadRequestException('fromDate and toDate are required to generate sessions');
      }
      const result = await this.generator.generateForGroup(
        groupId,
        new Date(dto.fromDate),
        new Date(dto.toDate),
      );
      await this.audit.record({
        userId: user.id,
        action: 'SESSIONS_GENERATED',
        entity: 'Group',
        entityId: groupId,
        newValue: result,
      });
      return result;
    }

    if (!dto.sessionDate || !dto.startTime || !dto.endTime) {
      throw new BadRequestException('sessionDate, startTime, and endTime are required');
    }

    const session = await this.prisma.classSession.create({
      data: {
        groupId,
        sessionDate: new Date(dto.sessionDate),
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: dto.status ?? 'SCHEDULED',
        notes: dto.notes,
      },
      include: {
        group: { include: { course: true } },
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'SESSION_CREATED',
      entity: 'ClassSession',
      entityId: session.id,
    });

    return this.toDetail(session);
  }

  async listTodayClasses(user: AuthenticatedUser, query: ListTodaySessionsQueryDto): Promise<TodayClassItem[]> {
    const date = query.date ? new Date(query.date) : new Date();
    date.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const groupFilter = await this.access.getAccessibleGroupFilter(user);
    const groups = await this.prisma.group.findMany({
      where: { ...groupFilter, status: { in: ['ACTIVE', 'PLANNED'] } },
      select: { id: true },
    });

    for (const group of groups) {
      await this.generator.ensureSessionsForDate(group.id, date);
    }

    const sessions = await this.prisma.classSession.findMany({
      where: {
        group: groupFilter,
        sessionDate: { gte: date, lte: dateEnd },
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
      orderBy: [{ startTime: 'asc' }],
      include: {
        group: {
          include: {
            course: true,
            enrollments: { where: { status: 'ACTIVE', deletedAt: null } },
          },
        },
        attendances: true,
      },
    });

    return sessions.map((session) => ({
      sessionId: session.id,
      groupId: session.groupId,
      groupName: session.group.name,
      courseName: session.group.course.name,
      sessionDate: session.sessionDate.toISOString().slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime,
      status: toApiSessionStatus(session.status),
      enrolledCount: session.group.enrollments.length,
      markedCount: session.attendances.length,
      attendanceSubmitted: Boolean(session.attendanceSubmittedAt),
    }));
  }

  async listSchedule(user: AuthenticatedUser, query: ListScheduleQueryDto): Promise<InstructorScheduleResponse> {
    const fromDate = query.fromDate ? parseDateOnly(query.fromDate) : startOfWeekMonday(new Date());
    const toDate = query.toDate ? parseDateOnly(query.toDate) : addDays(fromDate, 6);

    if (toDate < fromDate) {
      throw new BadRequestException('toDate must be on or after fromDate');
    }

    const maxRange = addDays(fromDate, 31);
    if (toDate > maxRange) {
      throw new BadRequestException('Date range cannot exceed 31 days');
    }

    const groupFilter = await this.access.getAccessibleGroupFilter(user);
    const groups = await this.prisma.group.findMany({
      where: { ...groupFilter, status: { in: ['ACTIVE', 'PLANNED'] } },
      include: {
        course: true,
        schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        enrollments: { where: { status: 'ACTIVE', deletedAt: null } },
      },
    });

    for (const group of groups) {
      await this.generator.generateForGroup(group.id, fromDate, toDate);
    }

    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    const sessions = await this.prisma.classSession.findMany({
      where: {
        group: groupFilter,
        sessionDate: { gte: fromDate, lte: toDateEnd },
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
      include: {
        group: {
          include: {
            course: true,
            enrollments: { where: { status: 'ACTIVE', deletedAt: null } },
          },
        },
        attendances: true,
      },
    });

    return {
      fromDate: toDateOnly(fromDate),
      toDate: toDateOnly(toDate),
      sessions: sessions.map((session) => ({
        sessionId: session.id,
        groupId: session.groupId,
        groupName: session.group.name,
        courseName: session.group.course.name,
        room: session.group.room,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        startTime: session.startTime,
        endTime: session.endTime,
        status: toApiSessionStatus(session.status),
        enrolledCount: session.group.enrollments.length,
        markedCount: session.attendances.length,
        attendanceSubmitted: Boolean(session.attendanceSubmittedAt),
      })),
      weekly: groups.flatMap((group) =>
        group.schedules.map((schedule) => ({
          groupId: group.id,
          groupName: group.name,
          courseName: group.course.name,
          room: group.room,
          dayOfWeek: schedule.dayOfWeek,
          dayLabel: DAY_LABELS[schedule.dayOfWeek] ?? `Day ${schedule.dayOfWeek}`,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        })),
      ),
      groups: groups.map((group) => ({
        groupId: group.id,
        groupName: group.name,
        courseName: group.course.name,
        room: group.room,
        status: group.status,
        enrolledCount: group.enrollments.length,
        scheduleSummary: formatSchedulesLabel(group.schedules),
      })),
    };
  }

  assertCanManageAttendance(user: AuthenticatedUser) {
    if (this.access.isAdmin(user)) return;
    if (user.permissions.includes('attendance.manage')) return;
    throw new ForbiddenException('Insufficient permissions');
  }

  async assertGroupAccess(user: AuthenticatedUser, groupId: string) {
    await this.access.assertCanAccessGroup(user, groupId);
  }

  async assertSessionAccess(user: AuthenticatedUser, sessionId: string) {
    const session = await this.prisma.classSession.findFirst({
      where: { id: sessionId },
      include: { group: { include: { course: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.access.assertCanAccessGroup(user, session.groupId);
    return session;
  }

  toDetail(session: {
    id: string;
    groupId: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    status: ClassSessionStatus;
    notes: string | null;
    attendanceSubmittedAt: Date | null;
    group: { name: string; course: { name: string } };
  }): ClassSessionDetail {
    return {
      id: session.id,
      groupId: session.groupId,
      groupName: session.group.name,
      courseName: session.group.course.name,
      sessionDate: session.sessionDate.toISOString().slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime,
      status: toApiSessionStatus(session.status),
      notes: session.notes,
      attendanceSubmittedAt: session.attendanceSubmittedAt?.toISOString() ?? null,
    };
  }

  private toListItem(session: {
    id: string;
    groupId: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    status: ClassSessionStatus;
    attendanceSubmittedAt: Date | null;
    group: { name: string; course: { name: string }; enrollments: Array<{ id: string }> };
    attendances: Array<{ id: string }>;
  }): ClassSessionListItem {
    return {
      id: session.id,
      groupId: session.groupId,
      groupName: session.group.name,
      courseName: session.group.course.name,
      sessionDate: session.sessionDate.toISOString().slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime,
      status: toApiSessionStatus(session.status),
      attendanceSubmitted: Boolean(session.attendanceSubmittedAt),
      enrolledCount: session.group.enrollments.length,
      markedCount: session.attendances.length,
    };
  }
}

function startOfWeekMonday(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
