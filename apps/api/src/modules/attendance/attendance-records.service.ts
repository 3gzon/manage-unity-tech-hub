import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AbsenceEmailNotice,
  AttendanceStatus,
  GroupAttendanceResponse,
  SessionAttendanceResponse,
  StudentAttendanceStatistics,
  UpdateSessionAttendanceRequest,
} from '@unity/types';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { SaveGroupAttendanceDto, UpdateSessionAttendanceDto } from './dto/attendance.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionsService } from './sessions.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { currentBranchId } from '../../common/branch/branch-context';

@Injectable()
export class AttendanceRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
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
        return {
          studentId: enrollment.studentId,
          studentName,
          status: (existing?.status ?? 'PRESENT') as AttendanceStatus,
          notes: existing?.notes ?? null,
          notifyEmails: absenceRecipients(enrollment.student),
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
      select: {
        studentId: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            parents: {
              select: { parent: { select: { email: true, deletedAt: true } } },
            },
          },
        },
      },
    });
    const enrolledById = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment]));

    let records = dto.records.filter((record) => enrolledById.has(record.studentId));

    if (dto.markAllPresent) {
      records = [...enrolledById.keys()].map((studentId) => ({
        studentId,
        status: 'PRESENT' as const,
        notes: records.find((r) => r.studentId === studentId)?.notes,
      }));
    }

    for (const record of records) {
      if (record.status === 'ABSENT' && !(record.notes ?? '').trim()) {
        const student = enrolledById.get(record.studentId)?.student;
        const name = student ? `${student.firstName} ${student.lastName}` : 'This student';
        throw new BadRequestException(`Add a comment explaining why ${name} is missing`);
      }
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
            branchId: currentBranchId()!,
            classSessionId: sessionId,
            studentId: record.studentId,
            status: record.status,
            notes: record.notes?.trim() || null,
          },
          update: {
            status: record.status,
            notes: record.notes?.trim() || null,
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

    const detail = this.sessions.toDetail(session);
    const emailNotices: AbsenceEmailNotice[] = [];
    for (const record of records) {
      if (record.status !== 'ABSENT') continue;
      const previous = existingByStudent.get(record.studentId);
      const reason = record.notes?.trim() ?? '';
      const alreadySent = previous?.status === 'ABSENT' && (previous.notes ?? '').trim() === reason;
      if (alreadySent) continue;

      const student = enrolledById.get(record.studentId)?.student;
      if (!student) continue;
      const result = await this.mail.sendAbsenceNotice({
        to: absenceRecipients(student),
        studentName: `${student.firstName} ${student.lastName}`,
        courseName: detail.courseName,
        groupName: detail.groupName,
        sessionDate: detail.sessionDate,
        startTime: detail.startTime,
        endTime: detail.endTime,
        reason,
      });
      emailNotices.push({
        studentId: record.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        sentTo: result.sentTo,
        detail: result.detail,
      });
    }

    return { ...(await this.getSessionAttendance(user, sessionId)), emailNotices };
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
        select: { classSessionId: true, studentId: true, status: true, notes: true },
      }),
    ]);

    const attendanceKey = new Map(
      attendances.map((row) => [
        `${row.classSessionId}:${row.studentId}`,
        { status: row.status as AttendanceStatus, notes: row.notes },
      ]),
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
          const entry = attendanceKey.get(`${session.id}:${enrollment.studentId}`) ?? null;
          const status = entry?.status ?? null;
          return {
            sessionId: session.id,
            sessionDate: session.sessionDate.toISOString().slice(0, 10),
            startTime: session.startTime,
            status,
            inClass: status === null ? null : status === 'PRESENT' || status === 'LATE',
            notes: entry?.notes ?? null,
          };
        });

        return {
          studentId: enrollment.studentId,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
          classesAttended: records.filter((record) => record.inClass === true).length,
          classesHeld: sessions.length,
          months: monthlyAttendance(records),
          records,
        };
      }),
    };
  }

  async saveGroupAttendance(
    user: AuthenticatedUser,
    groupId: string,
    dto: SaveGroupAttendanceDto,
  ): Promise<GroupAttendanceResponse> {
    await this.sessions.assertGroupAccess(user, groupId);
    this.sessions.assertCanManageAttendance(user);
    if (!dto.changes.length) return this.getGroupAttendance(user, groupId);

    const sessionIds = [...new Set(dto.changes.map((change) => change.sessionId))];
    const sessions = await this.prisma.classSession.findMany({
      where: { id: { in: sessionIds }, groupId },
      include: { group: { include: { course: true } } },
    });
    if (sessions.length !== sessionIds.length) {
      throw new BadRequestException('One of these classes is not in this group');
    }
    const sessionById = new Map(sessions.map((session) => [session.id, session]));

    const enrollments = await this.prisma.enrollment.findMany({
      where: { groupId, status: { in: ['ACTIVE', 'PENDING'] }, deletedAt: null },
      include: {
        student: {
          include: {
            parents: { include: { parent: true } },
          },
        },
      },
    });
    const enrolledById = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment]));

    for (const change of dto.changes) {
      const enrollment = enrolledById.get(change.studentId);
      if (!enrollment) throw new BadRequestException('One of these students is not enrolled in this group');
      if (change.mark === 'ABSENT' && !(change.notes ?? '').trim()) {
        const name = `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim();
        const session = sessionById.get(change.sessionId);
        const when = session ? session.sessionDate.toISOString().slice(0, 10) : 'that day';
        throw new BadRequestException(`Add a comment explaining why ${name} is missing on ${when}`);
      }
    }

    const existing = await this.prisma.attendance.findMany({
      where: { classSessionId: { in: sessionIds } },
    });
    const existingKey = new Map(existing.map((row) => [`${row.classSessionId}:${row.studentId}`, row]));

    await this.prisma.$transaction(async (tx) => {
      for (const change of dto.changes) {
        if (change.mark === 'CLEAR') {
          await tx.attendance.deleteMany({
            where: { classSessionId: change.sessionId, studentId: change.studentId },
          });
          continue;
        }
        const notes = change.notes?.trim() || null;
        await tx.attendance.upsert({
          where: {
            classSessionId_studentId: {
              classSessionId: change.sessionId,
              studentId: change.studentId,
            },
          },
          create: {
            branchId: currentBranchId()!,
            classSessionId: change.sessionId,
            studentId: change.studentId,
            status: change.mark,
            notes,
          },
          update: { status: change.mark, notes },
        });
      }
    });

    const detailGroup = sessions[0];
    for (const change of dto.changes) {
      if (change.mark !== 'ABSENT') continue;
      const previous = existingKey.get(`${change.sessionId}:${change.studentId}`);
      const reason = change.notes?.trim() ?? '';
      const alreadySent = previous?.status === 'ABSENT' && (previous.notes ?? '').trim() === reason;
      if (alreadySent) continue;
      const enrollment = enrolledById.get(change.studentId);
      const session = sessionById.get(change.sessionId);
      if (!enrollment || !session || !detailGroup) continue;
      const studentName = `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim();
      await this.mail.sendAbsenceNotice({
        to: absenceRecipients(enrollment.student),
        studentName,
        courseName: detailGroup.group.course.name,
        groupName: detailGroup.group.name,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        startTime: session.startTime,
        endTime: session.endTime,
        reason,
      });
    }

    if (detailGroup) {
      const instructorName = `${user.firstName} ${user.lastName}`.trim();
      const absentCount = dto.changes.filter((change) => change.mark === 'ABSENT').length;
      await this.notifications.notifyAdmins({
        excludeUserId: user.id,
        type: absentCount ? 'WARNING' : 'INFO',
        title: `Attendance updated — ${detailGroup.group.name}`,
        message: `${instructorName} updated ${dto.changes.length} attendance ${dto.changes.length === 1 ? 'mark' : 'marks'} for ${detailGroup.group.name}.`,
      });
    }

    return this.getGroupAttendance(user, groupId);
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

function monthlyAttendance(
  records: Array<{ sessionDate: string; inClass: boolean | null }>,
) {
  const months = new Map<string, { attended: number; held: number }>();
  for (const record of records) {
    const month = record.sessionDate.slice(0, 7);
    const current = months.get(month) ?? { attended: 0, held: 0 };
    current.held += 1;
    if (record.inClass) current.attended += 1;
    months.set(month, current);
  }

  return [...months.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([month, stats]) => ({
      month,
      attended: stats.attended,
      held: stats.held,
      percentage: stats.held === 0 ? 0 : Math.round((stats.attended / stats.held) * 1000) / 10,
    }));
}

function absenceRecipients(student: {
  email: string | null;
  parents: Array<{ parent: { email: string | null; deletedAt: Date | null } }>;
}): string[] {
  const emails = [
    student.email,
    ...student.parents.map((link) => (link.parent.deletedAt ? null : link.parent.email)),
  ];
  return [...new Set(emails.map((email) => email?.trim()).filter((email): email is string => Boolean(email)))];
}
