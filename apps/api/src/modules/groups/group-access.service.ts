import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class GroupAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthenticatedUser) {
    return user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN');
  }

  isInstructorOnly(user: AuthenticatedUser) {
    return user.roles.includes('INSTRUCTOR') && !this.isAdmin(user);
  }

  assertCanManageGroups(user: AuthenticatedUser) {
    if (this.isAdmin(user)) return;
    throw new ForbiddenException('Instructors cannot manage groups');
  }

  canViewFinancial(user: AuthenticatedUser) {
    return this.isAdmin(user);
  }

  async getInstructorId(userId: string): Promise<string | null> {
    const instructor = await this.prisma.instructor.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return instructor?.id ?? null;
  }

  async getAccessibleGroupFilter(user: AuthenticatedUser): Promise<Prisma.GroupWhereInput> {
    const base: Prisma.GroupWhereInput = { deletedAt: null };

    if (this.isAdmin(user)) return base;

    if (this.isInstructorOnly(user)) {
      const instructorId = await this.getInstructorId(user.id);
      if (!instructorId) return { ...base, id: { in: [] } };
      return { ...base, instructorId };
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  async assertCanAccessGroup(user: AuthenticatedUser, groupId: string) {
    if (this.isAdmin(user)) return;

    if (this.isInstructorOnly(user)) {
      const instructorId = await this.getInstructorId(user.id);
      if (!instructorId) throw new NotFoundException('Group not found');

      const group = await this.prisma.group.findFirst({
        where: { id: groupId, instructorId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Group not found');
      return;
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  async assertCanAccessCourseViaGroup(user: AuthenticatedUser, courseId: string) {
    if (this.isAdmin(user)) return;

    if (this.isInstructorOnly(user)) {
      const instructorId = await this.getInstructorId(user.id);
      if (!instructorId) throw new NotFoundException('Course not found');

      const group = await this.prisma.group.findFirst({
        where: { courseId, instructorId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Course not found');
      return;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
