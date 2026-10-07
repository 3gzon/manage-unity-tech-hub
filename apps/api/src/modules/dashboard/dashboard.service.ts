import { ForbiddenException, Injectable } from '@nestjs/common';
import type {
  AdminDashboardResponse,
  InstructorDashboardResponse,
} from '@unity/types';
import { formatSchedulesLabel } from '../groups/schedule.util';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminDashboard(_user: AuthenticatedUser): Promise<AdminDashboardResponse> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      activeStudents,
      activeGroups,
      activeInstructors,
      revenueAggregate,
      outstandingAggregate,
      unpaidInvoices,
      recentPayments,
      upcomingClasses,
      outstandingInvoices,
      recentEnrollments,
    ] = await Promise.all([
      this.prisma.student.count({
        where: {
          deletedAt: null,
          enrollments: { some: { status: 'ACTIVE', deletedAt: null } },
        },
      }),
      this.prisma.group.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.instructor.count({
        where: { deletedAt: null },
      }),
      this.prisma.payment.aggregate({
        where: {
          deletedAt: null,
          paymentDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          deletedAt: null,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { remainingAmount: true },
      }),
      this.prisma.invoice.count({
        where: {
          deletedAt: null,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
      }),
      this.prisma.payment.findMany({
        where: { deletedAt: null },
        orderBy: { paymentDate: 'desc' },
        take: 5,
        include: { student: true },
      }),
      this.prisma.classSession.findMany({
        where: {
          sessionDate: { gte: now },
          status: { in: ['SCHEDULED'] },
        },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
        take: 5,
        include: { group: { include: { course: true } } },
      }),
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
        include: { student: true },
      }),
      this.prisma.enrollment.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          student: true,
          group: { include: { course: true } },
        },
      }),
    ]);

    return {
      metrics: {
        activeStudents,
        activeGroups,
        activeInstructors,
        revenueThisMonth: this.formatDecimal(revenueAggregate._sum.amount),
        outstandingPayments: this.formatDecimal(outstandingAggregate._sum.remainingAmount),
        unpaidInvoices,
      },
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        studentName: `${payment.student.firstName} ${payment.student.lastName}`,
        amount: this.formatDecimal(payment.amount),
        method: payment.method,
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      })),
      upcomingClasses: upcomingClasses.map((session) => ({
        id: session.id,
        groupName: session.group.name,
        courseName: session.group.course.name,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
      })),
      outstandingInvoices: outstandingInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
        total: this.formatDecimal(invoice.total),
        remainingAmount: this.formatDecimal(invoice.remainingAmount),
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        status: invoice.status,
      })),
      recentEnrollments: recentEnrollments.map((enrollment) => ({
        id: enrollment.id,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        groupName: enrollment.group.name,
        courseName: enrollment.group.course.name,
        status: enrollment.status,
        startDate: enrollment.startDate.toISOString().slice(0, 10),
      })),
    };
  }

  async getInstructorDashboard(user: AuthenticatedUser): Promise<InstructorDashboardResponse> {
    const instructor = await this.prisma.instructor.findFirst({
      where: { userId: user.id, deletedAt: null },
    });

    if (!instructor) {
      throw new ForbiddenException('Instructor profile not linked to this account');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const groups = await this.prisma.group.findMany({
      where: {
        instructorId: instructor.id,
        deletedAt: null,
        status: { in: ['ACTIVE', 'PLANNED'] },
      },
      include: {
        course: true,
        schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        enrollments: {
          where: { status: 'ACTIVE', deletedAt: null },
        },
        classSessions: {
          where: {
            sessionDate: { gte: todayStart },
            status: { in: ['SCHEDULED'] },
          },
          orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
          take: 10,
          include: {
            attendances: true,
          },
        },
      },
    });

    const groupIds = groups.map((group) => group.id);

    const todaysClasses = await this.prisma.classSession.findMany({
      where: {
        groupId: { in: groupIds },
        sessionDate: { gte: todayStart, lte: todayEnd },
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
      orderBy: { startTime: 'asc' },
      include: { group: { include: { course: true } } },
    });

    const upcomingClasses = await this.prisma.classSession.findMany({
      where: {
        groupId: { in: groupIds },
        sessionDate: { gt: todayEnd },
        status: { in: ['SCHEDULED'] },
      },
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
      take: 5,
      include: { group: { include: { course: true } } },
    });

    const studentsAssigned = await this.prisma.enrollment.count({
      where: {
        groupId: { in: groupIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    const pendingSessions = await this.prisma.classSession.findMany({
      where: {
        groupId: { in: groupIds },
        sessionDate: { lte: todayEnd },
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
      include: {
        attendances: true,
        group: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE', deletedAt: null },
            },
          },
        },
      },
    });

    const attendancePending = pendingSessions.filter((session) => {
      const expected = session.group.enrollments.length;
      return session.attendances.length < expected;
    }).length;

    const mapSession = (session: (typeof todaysClasses)[number]) => ({
      id: session.id,
      groupName: session.group.name,
      courseName: session.group.course.name,
      sessionDate: session.sessionDate.toISOString().slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
    });

    return {
      metrics: {
        todaysClasses: todaysClasses.length,
        upcomingClasses: upcomingClasses.length,
        activeGroups: groups.filter((group) => group.status === 'ACTIVE').length,
        studentsAssigned,
        attendancePending,
      },
      todaysClasses: todaysClasses.map(mapSession),
      upcomingClasses: upcomingClasses.map(mapSession),
      activeGroups: groups
        .filter((group) => group.status === 'ACTIVE')
        .map((group) => ({
          id: group.id,
          name: group.name,
          courseName: group.course.name,
          studentCount: group.enrollments.length,
          scheduleLabel: formatSchedulesLabel(group.schedules),
        })),
    };
  }

  private formatDecimal(value: import('@prisma/client').Prisma.Decimal | null | undefined): string {
    if (!value) {
      return '0.00';
    }
    return Number(value).toFixed(2);
  }
}
