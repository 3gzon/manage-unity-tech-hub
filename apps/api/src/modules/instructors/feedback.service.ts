import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FeedbackRating, SendStudentFeedbackResponse, StudentFeedbackItem, StudentFeedbackListResponse } from '@unity/types';
import { Prisma } from '@prisma/client';
import { isPortalAdmin } from '../../common/auth/portal-access';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { ListFeedbackQueryDto, SendStudentFeedbackDto } from './dto/feedback.dto';
import { renderFeedbackPdf } from './feedback-pdf';
import { currentBranchId } from '../../common/branch/branch-context';

const feedbackInclude = {
  student: { select: { firstName: true, lastName: true } },
  instructor: { select: { firstName: true, lastName: true } },
  group: { select: { name: true, course: { select: { name: true } } } },
} satisfies Prisma.StudentFeedbackInclude;

type FeedbackRecord = Prisma.StudentFeedbackGetPayload<{ include: typeof feedbackInclude }>;

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async send(
    user: AuthenticatedUser,
    instructorId: string,
    dto: SendStudentFeedbackDto,
  ): Promise<SendStudentFeedbackResponse> {
    const instructor = await this.prisma.instructor.findFirst({
      where: { id: instructorId, deletedAt: null },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');

    const isStaff = isPortalAdmin(user.roles);
    if (!isStaff && instructor.userId !== user.id) {
      throw new ForbiddenException('You can only send feedback for your own students');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: dto.studentId,
        groupId: dto.groupId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'PENDING'] },
        student: { deletedAt: null },
        group: { instructorId, deletedAt: null },
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        group: { select: { name: true, course: { select: { name: true } } } },
      },
    });
    if (!enrollment) {
      throw new BadRequestException('That student is not assigned to this instructor in the selected group');
    }

    const studentName = `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim();
    const instructorName = `${instructor.firstName} ${instructor.lastName}`.trim();
    const settings = await this.settings.get();
    const pdf = await renderFeedbackPdf({
      schoolName: settings.schoolName,
      date: formatFeedbackDate(new Date()),
      instructorName,
      studentName,
      courseName: enrollment.group.course.name,
      groupName: enrollment.group.name,
      period: dto.period.trim(),
      overall: dto.overall,
      participation: dto.participation,
      understanding: dto.understanding,
      practice: dto.practice,
      attendance: dto.attendance,
      strengths: dto.strengths.trim(),
      improvements: dto.improvements.trim(),
      nextSteps: dto.nextSteps.trim(),
    });

    const result = await this.mail.sendFeedbackPdf({
      to: dto.email,
      studentName,
      courseName: enrollment.group.course.name,
      groupName: enrollment.group.name,
      period: dto.period.trim(),
      instructorName,
      pdf,
    });
    if (result.sentTo.length === 0) {
      throw new BadRequestException(result.detail);
    }

    await this.prisma.studentFeedback.create({
      data: {
        branchId: currentBranchId()!,
        studentId: dto.studentId,
        instructorId,
        groupId: dto.groupId,
        period: dto.period.trim(),
        overall: dto.overall,
        participation: dto.participation,
        understanding: dto.understanding,
        practice: dto.practice,
        attendance: dto.attendance,
        strengths: dto.strengths.trim(),
        improvements: dto.improvements.trim(),
        nextSteps: dto.nextSteps.trim(),
        sentTo: result.sentTo[0] ?? dto.email.trim().toLowerCase(),
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'STUDENT_FEEDBACK_SENT',
      entity: 'Student',
      entityId: dto.studentId,
      newValue: {
        instructorId,
        groupId: dto.groupId,
        period: dto.period.trim(),
        email: result.sentTo[0],
        overall: dto.overall,
      },
    });

    return { sentTo: result.sentTo[0] ?? dto.email, detail: result.detail };
  }

  async list(user: AuthenticatedUser, query: ListFeedbackQueryDto): Promise<StudentFeedbackListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.StudentFeedbackWhereInput = {
      AND: [
        await this.visibility(user),
        query.studentId ? { studentId: query.studentId } : {},
        query.instructorId ? { instructorId: query.instructorId } : {},
        feedbackSearch(query.search),
      ],
    };

    const [total, rows] = await Promise.all([
      this.prisma.studentFeedback.count({ where }),
      this.prisma.studentFeedback.findMany({
        where,
        include: feedbackInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.toItem(row)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async pdf(user: AuthenticatedUser, id: string) {
    const feedback = await this.requireVisible(user, id);
    const settings = await this.settings.get();
    const buffer = await renderFeedbackPdf({
      schoolName: settings.schoolName,
      date: formatFeedbackDate(feedback.createdAt),
      instructorName: personName(feedback.instructor),
      studentName: personName(feedback.student),
      courseName: feedback.group.course.name,
      groupName: feedback.group.name,
      period: feedback.period,
      overall: asRating(feedback.overall),
      participation: asRating(feedback.participation),
      understanding: asRating(feedback.understanding),
      practice: asRating(feedback.practice),
      attendance: asRating(feedback.attendance),
      strengths: feedback.strengths,
      improvements: feedback.improvements,
      nextSteps: feedback.nextSteps,
    });
    return { buffer, studentName: personName(feedback.student) };
  }

  private async requireVisible(user: AuthenticatedUser, id: string) {
    const feedback = await this.prisma.studentFeedback.findFirst({
      where: { id, AND: [await this.visibility(user)] },
      include: feedbackInclude,
    });
    if (!feedback) throw new NotFoundException('Feedback not found');
    return feedback;
  }

  private async visibility(user: AuthenticatedUser): Promise<Prisma.StudentFeedbackWhereInput> {
    if (isPortalAdmin(user.roles)) return {};
    const instructor = await this.prisma.instructor.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!instructor) return { id: { in: [] } };
    return {
      OR: [
        { instructorId: instructor.id },
        {
          student: {
            enrollments: {
              some: {
                deletedAt: null,
                status: { in: ['ACTIVE', 'PENDING'] },
                group: { instructorId: instructor.id, deletedAt: null },
              },
            },
          },
        },
      ],
    };
  }

  private toItem(row: FeedbackRecord): StudentFeedbackItem {
    return {
      id: row.id,
      studentId: row.studentId,
      studentName: personName(row.student),
      instructorId: row.instructorId,
      instructorName: personName(row.instructor),
      groupId: row.groupId,
      groupName: row.group.name,
      courseName: row.group.course.name,
      period: row.period,
      overall: asRating(row.overall),
      participation: asRating(row.participation),
      understanding: asRating(row.understanding),
      practice: asRating(row.practice),
      attendance: asRating(row.attendance),
      strengths: row.strengths,
      improvements: row.improvements,
      nextSteps: row.nextSteps,
      sentTo: row.sentTo,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function personName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function asRating(value: string): FeedbackRating {
  if (value === 'EXCELLENT' || value === 'GOOD' || value === 'SATISFACTORY' || value === 'NEEDS_SUPPORT') {
    return value;
  }
  return 'GOOD';
}

function feedbackSearch(search?: string): Prisma.StudentFeedbackWhereInput {
  const terms = search?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!terms.length) return {};
  return {
    AND: terms.map((term) => ({
      OR: [
        { period: { contains: term, mode: 'insensitive' as const } },
        { student: { firstName: { contains: term, mode: 'insensitive' as const } } },
        { student: { lastName: { contains: term, mode: 'insensitive' as const } } },
        { instructor: { firstName: { contains: term, mode: 'insensitive' as const } } },
        { instructor: { lastName: { contains: term, mode: 'insensitive' as const } } },
        { group: { name: { contains: term, mode: 'insensitive' as const } } },
        { group: { course: { name: { contains: term, mode: 'insensitive' as const } } } },
      ],
    })),
  };
}

function formatFeedbackDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}
