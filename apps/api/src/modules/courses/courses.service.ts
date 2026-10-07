import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CourseDetail,
  CourseListItem,
  CourseListResponse,
  CreateCourseRequest,
  UpdateCourseRequest,
} from '@unity/types';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { GroupAccessService } from '../groups/group-access.service';
import type { ListCoursesQueryDto } from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupAccessService,
    private readonly audit: AuditService,
  ) {}

  async findAll(user: AuthenticatedUser, query: ListCoursesQueryDto): Promise<CourseListResponse> {
    if (this.access.isInstructorOnly(user)) {
      return this.findAllForInstructor(user, query);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CourseWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.CourseOrderByWithRelationInput = {
      [query.sortBy ?? 'name']: query.sortOrder ?? 'asc',
    };

    const [total, courses] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          groups: {
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true },
          },
        },
      }),
    ]);

    return {
      data: courses.map((course) => this.toListItem(course)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<CourseDetail> {
    if (this.access.isInstructorOnly(user)) {
      await this.access.assertCanAccessCourseViaGroup(user, id);
    }

    const course = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.toDetail(course);
  }

  async create(user: AuthenticatedUser, dto: CreateCourseRequest) {
    this.access.assertCanManageGroups(user);

    const code = dto.code?.trim() || (await this.generateUniqueCode(dto.name));
    const course = await this.prisma.course.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description,
        category: dto.category,
        ageMin: dto.ageMin,
        ageMax: dto.ageMax,
        durationMonths: dto.durationMonths,
        defaultMonthlyPrice: dto.defaultMonthlyPrice,
        status: dto.status ?? 'DRAFT',
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'CREATE',
      entity: 'Course',
      entityId: course.id,
      newValue: { name: course.name, code: course.code },
    });

    return this.toDetail(course);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateCourseRequest) {
    this.access.assertCanManageGroups(user);
    await this.assertExists(id);

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        name: dto.name?.trim(),
        description: dto.description,
        category: dto.category,
        ageMin: dto.ageMin,
        ageMax: dto.ageMax,
        durationMonths: dto.durationMonths,
        defaultMonthlyPrice: dto.defaultMonthlyPrice,
        status: dto.status,
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'UPDATE',
      entity: 'Course',
      entityId: id,
    });

    return this.toDetail(course);
  }

  async archive(user: AuthenticatedUser, id: string) {
    this.access.assertCanManageGroups(user);
    await this.assertExists(id);

    await this.prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    await this.audit.record({
      userId: user.id,
      action: 'ARCHIVE',
      entity: 'Course',
      entityId: id,
    });
  }

  private async findAllForInstructor(
    user: AuthenticatedUser,
    query: ListCoursesQueryDto,
  ): Promise<CourseListResponse> {
    const instructorId = await this.access.getInstructorId(user.id);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    if (!instructorId) {
      return { data: [], meta: { page, pageSize, total: 0, totalPages: 1 } };
    }

    const groups = await this.prisma.group.findMany({
      where: { instructorId, deletedAt: null },
      select: { courseId: true },
    });
    const courseIds = [...new Set(groups.map((g) => g.courseId))];

    const where: Prisma.CourseWhereInput = {
      id: { in: courseIds },
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, courses] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          groups: {
            where: { instructorId, status: 'ACTIVE', deletedAt: null },
            select: { id: true },
          },
        },
      }),
    ]);

    return {
      data: courses.map((course) => this.toListItem(course)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  private async assertExists(id: string) {
    const course = await this.prisma.course.findFirst({ where: { id, deletedAt: null } });
    if (!course) throw new NotFoundException('Course not found');
  }

  private async generateUniqueCode(name: string) {
    const base =
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 16) || 'COURSE';

    let code = base;
    let suffix = 1;
    while (await this.prisma.course.findUnique({ where: { code } })) {
      code = `${base}-${suffix++}`;
    }
    return code;
  }

  private toListItem(course: {
    id: string;
    code: string;
    name: string;
    category: CourseListItem['category'];
    ageMin: number | null;
    ageMax: number | null;
    durationMonths: number | null;
    defaultMonthlyPrice: Prisma.Decimal | null;
    status: CourseListItem['status'];
    groups: Array<{ id: string }>;
  }): CourseListItem {
    return {
      id: course.id,
      code: course.code,
      name: course.name,
      category: course.category,
      ageMin: course.ageMin,
      ageMax: course.ageMax,
      durationMonths: course.durationMonths,
      defaultMonthlyPrice: course.defaultMonthlyPrice
        ? Number(course.defaultMonthlyPrice).toFixed(2)
        : null,
      status: course.status,
      activeGroupsCount: course.groups.length,
    };
  }

  private toDetail(course: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: CourseDetail['category'];
    ageMin: number | null;
    ageMax: number | null;
    durationMonths: number | null;
    defaultMonthlyPrice: Prisma.Decimal | null;
    status: CourseDetail['status'];
    createdAt: Date;
    updatedAt: Date;
  }): CourseDetail {
    return {
      id: course.id,
      code: course.code,
      name: course.name,
      description: course.description,
      category: course.category,
      ageMin: course.ageMin,
      ageMax: course.ageMax,
      durationMonths: course.durationMonths,
      defaultMonthlyPrice: course.defaultMonthlyPrice
        ? Number(course.defaultMonthlyPrice).toFixed(2)
        : null,
      status: course.status,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
    };
  }
}
