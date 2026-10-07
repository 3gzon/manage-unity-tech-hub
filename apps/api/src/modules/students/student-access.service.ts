import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class StudentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthenticatedUser) {
    return user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');
  }

  isInstructorOnly(user: AuthenticatedUser) {
    return user.roles.includes('INSTRUCTOR') && !this.isAdmin(user);
  }

  async getAccessibleStudentFilter(user: AuthenticatedUser): Promise<Prisma.StudentWhereInput> {
    const base: Prisma.StudentWhereInput = { deletedAt: null };

    if (this.isAdmin(user)) {
      return base;
    }

    if (this.isInstructorOnly(user)) {
      const studentIds = await this.getInstructorStudentIds(user.id);
      return { ...base, id: { in: studentIds } };
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  async assertCanAccessStudent(user: AuthenticatedUser, studentId: string) {
    if (this.isAdmin(user)) {
      return;
    }

    if (this.isInstructorOnly(user)) {
      const studentIds = await this.getInstructorStudentIds(user.id);
      if (!studentIds.includes(studentId)) {
        throw new NotFoundException('Student not found');
      }
      return;
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  assertCanMutate(user: AuthenticatedUser) {
    if (this.isAdmin(user)) {
      return;
    }
    throw new ForbiddenException('Read-only access');
  }

  canViewFinancial(user: AuthenticatedUser) {
    return this.isAdmin(user);
  }

  private async getInstructorStudentIds(userId: string): Promise<string[]> {
    const instructor = await this.prisma.instructor.findFirst({
      where: { userId, deletedAt: null },
    });

    if (!instructor) {
      return [];
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        deletedAt: null,
        status: { in: ['ACTIVE', 'PENDING', 'COMPLETED'] },
        group: {
          instructorId: instructor.id,
          deletedAt: null,
        },
      },
      select: { studentId: true },
    });

    return [...new Set(enrollments.map((entry) => entry.studentId))];
  }
}
