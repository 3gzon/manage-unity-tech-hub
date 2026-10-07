import { Injectable } from '@nestjs/common';
import type {
  AttendanceStatus,
  GroupAttendanceResponse,
  SessionAttendanceResponse,
  StudentAttendanceStatistics,
  UpdateSessionAttendanceRequest,
} from '@unity/types';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { UpdateSessionAttendanceDto } from './dto/attendance.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionsService } from './sessions.service';
import { whatsappLink } from './whatsapp';

@Injectable()
export class AttendanceRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async getSessionAttendance(user: AuthenticatedUser, sessionId: string): Promise<SessionAttendanceResponse> {
    const session = await this.sessions.assertSessionAccess(user, sessionId);

    const [enrollments, existingAttendances, statsByStudent] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { groupId: session.groupId, status: 'ACTIVE', deletedAt: null },
        include: {
          student: {
            include: {
              parents: {
                include: { parent: true },
                orderBy: { isPrimary: 'desc' },
              },
            },
          },
        },
        orderBy: { student: { lastName: 'asc' } },
      }),
      this.prisma.attendance.findMany({ where: { classSessionId: sessionId } }),
      this.buildStatisticsForGroup(session.groupId),
    ]);

    const attendanceByStudent = new Map(existingAttendances.map((a) => [a.studentId, a]));
    const detail = this.sessions.toDetail(session);

    return {
      session: detail,
      records: enrollments.map((enrollment) => {
        const existing = attendanceByStudent.get(enrollment.studentId);
        const studentName = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
        const contact = familyContact(enrollment.student);
        const message = `Përshëndetje, ${studentName} mungoi në mësimin ${detail.courseName} (${detail.groupName}) më ${detail.sessionDate}, ora ${detail.startTime}–${detail.endTime}.`;
        return {
          studentId: enrollment.studentId,
          studentName,
          status: (existing?.status ?? 'ABSENT') as AttendanceStatus,
          notes: existing?.notes ?? null,
          contactName: contact?.name ? contact.name : null,
          contactPhone: contact?.phone ?? null,
          whatsappUrl: contact ? whatsappLink(contact.phone, message) : null,
          statistics: statsByStudent.get(enrollment.studentId) ?? this.emptyStatistics(),
        };
      }),
    };
  }

  async updateSessionAttendance(
    user: AuthenticatedUser,
    sessionId: string,
    dto: UpdateSessionAttendanceDto,
  ): Promise<SessionAttendanceResponse> {
    const session = await this.sessions.assertSessionAccess(user, sessionId);
    this.sessions.assertCanManageAttendance(user);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { groupId: session.groupId, status: 'ACTIVE', deletedAt: null },
      select: { studentId: true },
    });
    const enrolledIds = new Set(enrollments.map((e) => e.studentId));

    let records = dto.records.filter((record) => enrolledIds.has(record.studentId));

    if (dto.markAllPresent) {
      records = [...enrolledIds].map((studentId) => ({
        studentId,
        status: 'PRESENT' as const,
        notes: records.find((r) => r.studentId === studentId)?.notes,
      }));
    }

    const existing = await this.prisma.attendance.findMany({
      where: { classSessionId: sessionId },
    });
    const existingByStudent = new Map(existing.map((a) => [a.studentId, a]));
    const isResubmission = Boolean(session.attendanceSubmittedAt);

    await this.prisma.$transaction(async (tx) => {
      for (const record of records) {
        const previous = existingByStudent.get(record.studentId);

        await tx.attendance.upsert({
          where: {
            classSessionId_studentId: {
              classSessionId: sessionId,
              studentId: record.studentId,
            },
          },
          create: {
            classSessionId: sessionId,
            studentId: record.studentId,
            status: record.status,
            notes: record.notes,
          },
          update: {
            status: record.status,
            notes: record.notes,
          },
        });

        if (isResubmission && previous && previous.status !== record.status) {
          await this.audit.record({
            userId: user.id,
            action: 'ATTENDANCE_UPDATED',
            entity: 'Attendance',
            entityId: previous.id,
            oldValue: { status: previous.status, studentId: record.studentId },
            newValue: { status: record.status, studentId: record.studentId },
          });
        }
      }

      await tx.classSession.update({
        where: { id: sessionId },
        data: {
          attendanceSubmittedAt: session.attendanceSubmittedAt ?? new Date(),
          ...(dto.completeSession ? { status: 'COMPLETED' } : {}),
        },
      });
    });

    if (!isResubmission) {
      await this.audit.record({
        userId: user.id,
        action: 'ATTENDANCE_CREATED',
        entity: 'ClassSession',
        entityId: sessionId,
        newValue: { recordCount: records.length },
      });
      await this.notifyAdminsOfAttendance(user, sessionId);
    }

    return this.getSessionAttendance(user, sessionId);
  }

  async getGroupAttendance(user: AuthenticatedUser, groupId: string): Promise<GroupAttendanceResponse> {
    await this.sessions.assertGroupAccess(user, groupId);

    const [sessions, enrollments, attendances] = await Promise.all([
      this.prisma.classSession.findMany({
        where: { groupId, status: { in: ['SCHEDULED', 'COMPLETED'] } },
        orderBy: [{ sessionDate: 'desc' }, { startTime: 'asc' }],
        select: {
          id: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          attendanceSubmittedAt: true,
        },
      }),
      this.prisma.enrollment.findMany({
        where: { groupId, status: { in: ['ACTIVE', 'PENDING'] }, deletedAt: null },
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: { student: { lastName: 'asc' } },
      }),
      this.prisma.attendance.findMany({
        where: { classSession: { groupId, status: { in: ['SCHEDULED', 'COMPLETED'] } } },
        select: { classSessionId: true, studentId: true, status: true },
      }),
    ]);

    const attendanceKey = new Map(
      attendances.map((row) => [`${row.classSessionId}:${row.studentId}`, row.status as AttendanceStatus]),
    );

    return {
      sessions: sessions.map((session) => ({
        sessionId: session.id,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        startTime: session.startTime,
        endTime: session.endTime,
        submitted: Boolean(session.attendanceSubmittedAt),
      })),
      students: enrollments.map((enrollment) => {
        const records = sessions.map((session) => {
          const status = attendanceKey.get(`${session.id}:${enrollment.studentId}`) ?? null;
          return {
            sessionId: session.id,
            sessionDate: session.sessionDate.toISOString().slice(0, 10),
            startTime: session.startTime,
            status,
            inClass: status === null ? null : status === 'PRESENT' || status === 'LATE',
          };
        });

        return {
          studentId: enrollment.studentId,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
          classesAttended: records.filter((record) => record.inClass === true).length,
          classesHeld: sessions.length,
          records,
        };
      }),
    };
  }

  private async notifyAdminsOfAttendance(user: AuthenticatedUser, sessionId: string) {
    const session = await this.prisma.classSession.findFirst({
      where: { id: sessionId },
      include: {
        group: { include: { course: true } },
        attendances: { include: { student: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!session) return;

    const missing = session.attendances
      .filter((row) => row.status === 'ABSENT')
      .map((row) => `${row.student.firstName} ${row.student.lastName}`.trim());
    const present = session.attendances.filter((row) => row.status === 'PRESENT').length;
    const late = session.attendances.filter((row) => row.status === 'LATE').length;
    const excused = session.attendances.filter((row) => row.status === 'EXCUSED').length;
    const instructorName = `${user.firstName} ${user.lastName}`.trim();
    const sessionDate = session.sessionDate.toISOString().slice(0, 10);
    const missingLabel = missing.length ? missing.join(', ') : 'none';

    await this.notifications.notifyAdmins({
      excludeUserId: user.id,
      type: missing.length ? 'WARNING' : 'INFO',
      title: `Attendance submitted — ${session.group.name}`,
      message: [
        `${instructorName} submitted attendance for ${session.group.name} (${session.group.course.name}) on ${sessionDate} ${session.startTime}–${session.endTime}.`,
        `Present: ${present}. Absent: ${missing.length} (${missingLabel}). Late: ${late}. Excused: ${excused}.`,
      ].join(' '),
    });
  }

  private async buildStatisticsForGroup(groupId: string) {
    const sessions = await this.prisma.classSession.findMany({
      where: {
        groupId,
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
      select: { id: true },
    });

    const sessionIds = sessions.map((s) => s.id);
    const attendances = await this.prisma.attendance.findMany({
      where: { classSessionId: { in: sessionIds } },
    });

    const statsMap = new Map<string, StudentAttendanceStatistics>();

    for (const attendance of attendances) {
      const current = statsMap.get(attendance.studentId) ?? this.emptyStatistics();
      current.totalSessions += 1;
      if (attendance.status === 'PRESENT') current.present += 1;
      if (attendance.status === 'ABSENT') current.absent += 1;
      if (attendance.status === 'LATE') current.late += 1;
      if (attendance.status === 'EXCUSED') current.excused += 1;
      current.attendancePercentage = this.calculatePercentage(current);
      statsMap.set(attendance.studentId, current);
    }

    return statsMap;
  }

  private emptyStatistics(): StudentAttendanceStatistics {
    return {
      totalSessions: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendancePercentage: 0,
    };
  }

  private calculatePercentage(stats: StudentAttendanceStatistics): number {
    if (stats.totalSessions === 0) return 0;
    const attended = stats.present + stats.late;
    return Math.round((attended / stats.totalSessions) * 1000) / 10;
  }
}

function familyContact(student: {
  phone: string | null;
  parents: Array<{ parent: { firstName: string; lastName: string; phone: string | null; deletedAt: Date | null } }>;
}): { name: string; phone: string } | null {
  const guardian = student.parents.find((link) => link.parent.phone && !link.parent.deletedAt);
  if (guardian?.parent.phone) {
    return {
      name: `${guardian.parent.firstName} ${guardian.parent.lastName}`.trim(),
      phone: guardian.parent.phone,
    };
  }
  if (student.phone) return { name: '', phone: student.phone };
  return null;
}
