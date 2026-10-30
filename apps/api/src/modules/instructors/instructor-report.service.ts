import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isPortalAdmin } from '../../common/auth/portal-access';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MailService } from '../../infrastructure/mail/mail.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { renderInstructorReportPdf } from './instructor-report-pdf';

const ZERO = new Prisma.Decimal(0);

export interface InstructorMonthlyReport {
  instructorName: string;
  email: string;
  period: string;
  fromDate: string;
  toDate: string;
  groups: Array<{
    groupName: string;
    courseName: string;
    activeStudents: number;
    sessionCount: number;
    totalHours: string;
    presentCount: number;
    absentCount: number;
    lateCount: number;
  }>;
  feedbackCount: number;
  compensation: {
    total: string;
    items: Array<{
      groupName: string;
      courseName: string;
      hoursTaught: string;
      studentCount: number;
      amount: string;
      status: string;
    }>;
  };
  summary: {
    totalGroups: number;
    totalStudents: number;
    totalSessions: number;
    totalHours: string;
    totalCompensation: string;
  };
}

@Injectable()
export class InstructorReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
  ) {}

  async generateReport(
    user: AuthenticatedUser,
    instructorId: string,
    fromDate: string,
    toDate: string,
  ): Promise<InstructorMonthlyReport> {
    const instructor = await this.requireAccess(user, instructorId);
    const from = this.parseDate(fromDate, 'fromDate');
    const to = this.parseDate(toDate, 'toDate', true);
    if (from > to) throw new BadRequestException('fromDate must be on or before toDate');

    const groups = await this.prisma.group.findMany({
      where: { instructorId, deletedAt: null },
      select: {
        id: true,
        name: true,
        course: { select: { name: true } },
        enrollments: {
          where: { deletedAt: null, status: { in: ['ACTIVE', 'PENDING'] }, student: { deletedAt: null } },
          select: { id: true },
        },
      },
    });

    const groupIds = groups.map((g) => g.id);

    const [sessions, attendances, feedbackCount, compensations] = await Promise.all([
      this.prisma.classSession.findMany({
        where: {
          groupId: { in: groupIds },
          sessionDate: { gte: from, lte: to },
          status: { in: ['COMPLETED', 'SCHEDULED'] },
        },
        select: { id: true, groupId: true, startTime: true, endTime: true },
      }),
      this.prisma.attendance.findMany({
        where: {
          classSession: {
            groupId: { in: groupIds },
            sessionDate: { gte: from, lte: to },
          },
        },
        select: { classSessionId: true, status: true },
      }),
      this.prisma.studentFeedback.count({
        where: {
          instructorId,
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.instructorCompensation.findMany({
        where: {
          instructorId,
          periodStart: { lte: to },
          periodEnd: { gte: from },
        },
        select: {
          groupId: true,
          hoursTaught: true,
          studentCount: true,
          finalAmount: true,
          status: true,
          group: { select: { name: true, course: { select: { name: true } } } },
        },
      }),
    ]);

    const sessionsByGroup = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const arr = sessionsByGroup.get(s.groupId) ?? [];
      arr.push(s);
      sessionsByGroup.set(s.groupId, arr);
    }

    const attendanceBySession = new Map<string, typeof attendances>();
    for (const a of attendances) {
      const arr = attendanceBySession.get(a.classSessionId) ?? [];
      arr.push(a);
      attendanceBySession.set(a.classSessionId, arr);
    }

    let totalSessions = 0;
    let totalHours = ZERO;
    let totalStudents = 0;

    const groupRows = groups.map((group) => {
      const groupSessions = sessionsByGroup.get(group.id) ?? [];
      let hours = ZERO;
      let present = 0;
      let absent = 0;
      let late = 0;

      for (const session of groupSessions) {
        hours = hours.plus(this.sessionHours(session.startTime, session.endTime));
        const records = attendanceBySession.get(session.id) ?? [];
        for (const record of records) {
          if (record.status === 'PRESENT') present++;
          else if (record.status === 'ABSENT') absent++;
          else if (record.status === 'LATE') late++;
        }
      }

      totalSessions += groupSessions.length;
      totalHours = totalHours.plus(hours);
      totalStudents += group.enrollments.length;

      return {
        groupName: group.name,
        courseName: group.course.name,
        activeStudents: group.enrollments.length,
        sessionCount: groupSessions.length,
        totalHours: hours.toFixed(1),
        presentCount: present,
        absentCount: absent,
        lateCount: late,
      };
    });

    const compTotal = compensations.reduce((sum, c) => sum.plus(c.finalAmount), ZERO);
    const compItems = compensations.map((c) => ({
      groupName: c.group.name,
      courseName: c.group.course.name,
      hoursTaught: c.hoursTaught.toFixed(1),
      studentCount: c.studentCount,
      amount: c.finalAmount.toFixed(2),
      status: c.status,
    }));

    const instructorName = `${instructor.firstName} ${instructor.lastName}`.trim();
    const period = `${fromDate} — ${toDate}`;

    return {
      instructorName,
      email: instructor.email,
      period,
      fromDate,
      toDate,
      groups: groupRows,
      feedbackCount,
      compensation: { total: compTotal.toFixed(2), items: compItems },
      summary: {
        totalGroups: groups.length,
        totalStudents,
        totalSessions,
        totalHours: totalHours.toFixed(1),
        totalCompensation: compTotal.toFixed(2),
      },
    };
  }

  async generatePdf(user: AuthenticatedUser, instructorId: string, fromDate: string, toDate: string) {
    const report = await this.generateReport(user, instructorId, fromDate, toDate);
    const settings = await this.settings.get();
    const pdf = await renderInstructorReportPdf(report, settings.schoolName);
    return { pdf, report };
  }

  async sendReportEmail(
    user: AuthenticatedUser,
    instructorId: string,
    fromDate: string,
    toDate: string,
    email: string,
  ) {
    const { pdf, report } = await this.generatePdf(user, instructorId, fromDate, toDate);
    const safeName = report.instructorName.replace(/[^\w.-]+/g, '-');
    const result = await this.mail.sendInstructorReport({
      to: email,
      instructorName: report.instructorName,
      period: report.period,
      pdf,
    });
    if (result.sentTo.length === 0) {
      throw new BadRequestException(result.detail);
    }
    return { sentTo: result.sentTo[0], detail: result.detail };
  }

  private async requireAccess(user: AuthenticatedUser, instructorId: string) {
    const instructor = await this.prisma.instructor.findFirst({
      where: { id: instructorId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, userId: true },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');
    if (!isPortalAdmin(user.roles) && instructor.userId !== user.id) {
      throw new BadRequestException('Not authorized to view this instructor report');
    }
    return instructor;
  }

  private sessionHours(startTime: string, endTime: string): Prisma.Decimal {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const minutes = (eh! * 60 + em!) - (sh! * 60 + sm!);
    return new Prisma.Decimal(Math.max(0, minutes)).div(60);
  }

  private parseDate(value: string, field: string, endOfDay = false) {
    const [yearPart, monthPart, dayPart] = value.split('-');
    if (!yearPart || !monthPart || !dayPart) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    }
    const y = Number.parseInt(yearPart, 10);
    const m = Number.parseInt(monthPart, 10);
    const d = Number.parseInt(dayPart, 10);
    if (endOfDay) return new Date(y, m - 1, d, 23, 59, 59, 999);
    return new Date(y, m - 1, d);
  }
}
