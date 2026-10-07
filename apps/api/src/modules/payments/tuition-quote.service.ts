import { Injectable } from '@nestjs/common';
import type { TuitionQuote } from '@unity/types';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { buildTuitionQuote, emptyTuitionQuote } from './tuition-discount';

const billedEnrollment = {
  deletedAt: null,
  status: 'ACTIVE' as const,
  billingEnabled: true,
  group: { deletedAt: null },
};

@Injectable()
export class TuitionQuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async forStudent(studentId: string): Promise<TuitionQuote> {
    const settings = await this.settings.get();
    const rates = {
      multiCoursePercent: settings.multiCourseDiscountPercent.toNumber(),
      familyPercent: settings.familyPackDiscountPercent.toNumber(),
    };
    const [enrollments, familyStudentNames] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: {
          studentId,
          ...billedEnrollment,
          group: { deletedAt: null, course: { deletedAt: null } },
        },
        include: {
          group: {
            select: {
              name: true,
              course: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.findEnrolledFamilyNames(studentId),
    ]);

    if (!enrollments.length) return emptyTuitionQuote(rates);

    return buildTuitionQuote(
      enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        courseId: enrollment.group.course.id,
        courseName: enrollment.group.course.name,
        groupName: enrollment.group.name,
        agreedMonthlyPrice: enrollment.agreedMonthlyPrice,
        manualDiscount: enrollment.discountAmount,
      })),
      familyStudentNames,
      rates,
    );
  }

  private async findEnrolledFamilyNames(studentId: string): Promise<string[]> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { familyId: true },
    });
    const names = new Map<string, string>();

    if (student?.familyId) {
      const members = await this.prisma.student.findMany({
        where: {
          familyId: student.familyId,
          id: { not: studentId },
          deletedAt: null,
          enrollments: { some: billedEnrollment },
        },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const member of members) {
        names.set(member.id, `${member.firstName} ${member.lastName}`);
      }
    }

    const links = await this.prisma.studentParent.findMany({
      where: { studentId },
      select: { parentId: true },
    });
    const parentIds = links.map((link) => link.parentId);
    if (parentIds.length) {
      const relatives = await this.prisma.studentParent.findMany({
        where: {
          parentId: { in: parentIds },
          studentId: { not: studentId },
          student: {
            deletedAt: null,
            enrollments: { some: billedEnrollment },
          },
        },
        select: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      for (const relative of relatives) {
        names.set(relative.student.id, `${relative.student.firstName} ${relative.student.lastName}`);
      }
    }

    return [...names.values()];
  }
}
