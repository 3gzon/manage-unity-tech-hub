import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateStudentRequest,
  ImportStudentsResponse,
  StudentFamily,
  StudentFilterOptionsResponse,
  StudentListItem,
  StudentListResponse,
  StudentPaymentStatus,
  StudentProfileResponse,
  UpdateStudentRequest,
} from '@unity/types';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { ListStudentsQueryDto } from './dto/student.dto';
import { StudentAccessService } from './student-access.service';

type StudentWithRelations = Prisma.StudentGetPayload<{
  include: {
    parents: { include: { parent: true } };
    enrollments: {
      include: { group: { include: { course: true } } };
    };
    invoices: true;
  };
}>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudentAccessService,
    private readonly audit: AuditService,
  ) {}

  async getFilterOptions(user: AuthenticatedUser): Promise<StudentFilterOptionsResponse> {
    if (this.access.isInstructorOnly(user)) {
      const instructor = await this.prisma.instructor.findFirst({
        where: { userId: user.id, deletedAt: null },
      });

      if (!instructor) {
        return { courses: [], groups: [] };
      }

      const groups = await this.prisma.group.findMany({
        where: { instructorId: instructor.id, deletedAt: null },
        select: { id: true, name: true, courseId: true, course: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });

      const courseMap = new Map<string, { id: string; name: string }>();
      for (const group of groups) {
        courseMap.set(group.course.id, group.course);
      }

      return {
        courses: [...courseMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        groups: groups.map((group) => ({ id: group.id, name: group.name, courseId: group.courseId })),
      };
    }

    const [courses, groups] = await Promise.all([
      this.prisma.course.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.group.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, courseId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { courses, groups };
  }

  async findAll(user: AuthenticatedUser, query: ListStudentsQueryDto): Promise<StudentListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const accessFilter = await this.access.getAccessibleStudentFilter(user);

    const where: Prisma.StudentWhereInput = {
      ...accessFilter,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.courseId || query.groupId
        ? {
            enrollments: {
              some: {
                deletedAt: null,
                ...(query.groupId ? { groupId: query.groupId } : {}),
                ...(query.courseId ? { group: { courseId: query.courseId } } : {}),
              },
            },
          }
        : {}),
    };

    const orderBy: Prisma.StudentOrderByWithRelationInput = {
      [query.sortBy ?? 'registrationDate']: query.sortOrder ?? 'desc',
    };

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          parents: {
            include: { parent: true },
            where: { isPrimary: true },
            take: 1,
          },
          enrollments: {
            where: { status: 'ACTIVE', deletedAt: null },
            include: { group: { include: { course: true } } },
            take: 1,
            orderBy: { startDate: 'desc' },
          },
          invoices: {
            where: { deletedAt: null },
            select: { status: true, remainingAmount: true },
          },
        },
      }),
    ]);

    let items = students.map((student) => this.toListItem(student));

    if (query.paymentStatus) {
      items = items.filter((item) => item.paymentStatus === query.paymentStatus);
    }

    return {
      data: items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<StudentProfileResponse> {
    await this.access.assertCanAccessStudent(user, id);

    const student = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        family: {
          include: {
            students: {
              where: { deletedAt: null },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                enrollments: {
                  where: { deletedAt: null, status: 'ACTIVE', billingEnabled: true },
                  select: { id: true },
                },
              },
              orderBy: { firstName: 'asc' },
            },
          },
        },
        parents: { include: { parent: true } },
        enrollments: {
          where: { deletedAt: null },
          include: { group: { include: { course: true } } },
          orderBy: { startDate: 'desc' },
        },
        attendances: {
          include: { classSession: { include: { group: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { issueDate: 'desc' },
        },
        payments: {
          where: { deletedAt: null },
          orderBy: { paymentDate: 'desc' },
        },
        certificates: {
          include: { course: true },
          orderBy: { issuedDate: 'desc' },
        },
        instructor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return this.toProfile(student, user);
  }

  async create(user: AuthenticatedUser, dto: CreateStudentRequest) {
    this.access.assertCanMutate(user);

    await this.assertInstructor(dto.instructorId);

    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          age: dto.age,
          gender: dto.gender,
          phone: dto.phone,
          email: dto.email?.toLowerCase(),
          address: dto.address,
          school: dto.school,
          notes: dto.notes,
          instructorId: dto.instructorId,
          status: dto.status ?? 'ACTIVE',
          registrationDate: dto.registrationDate ? new Date(dto.registrationDate) : new Date(),
        },
      });

      if (dto.guardians?.length) {
        await this.syncGuardians(tx, created.id, dto.guardians);
      }

      return created;
    });

    await this.audit.record({
      userId: user.id,
      action: 'STUDENT_CREATED',
      entity: 'Student',
      entityId: student.id,
      newValue: { firstName: student.firstName, lastName: student.lastName },
    });

    return this.findOne(user, student.id);
  }

  async importStudents(
    user: AuthenticatedUser,
    items: Array<{ row: number; student: CreateStudentRequest }>,
  ): Promise<ImportStudentsResponse> {
    this.access.assertCanMutate(user);

    const result: ImportStudentsResponse = { created: 0, skipped: 0, failed: [] };

    for (const item of items) {
      const firstName = item.student.firstName?.trim() ?? '';
      const lastName = item.student.lastName?.trim() ?? '';
      const name = `${firstName} ${lastName}`.trim();

      try {
        if (!firstName || !lastName) {
          throw new BadRequestException('First name and last name are required');
        }

        const existing = await this.prisma.student.findFirst({
          where: {
            deletedAt: null,
            firstName: { equals: firstName, mode: 'insensitive' },
            lastName: { equals: lastName, mode: 'insensitive' },
          },
          select: { id: true },
        });

        if (existing) {
          result.skipped += 1;
          continue;
        }

        await this.create(user, { ...item.student, firstName, lastName });
        result.created += 1;
      } catch (error) {
        result.failed.push({
          row: item.row,
          name: name || `Row ${item.row}`,
          message: this.importErrorMessage(error),
        });
      }
    }

    return result;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateStudentRequest) {
    this.access.assertCanMutate(user);
    await this.assertExists(id);
    if (dto.instructorId) {
      await this.assertInstructor(dto.instructorId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          ...(dto.age !== undefined ? { age: dto.age } : {}),
          gender: dto.gender,
          phone: dto.phone,
          email: dto.email?.toLowerCase(),
          address: dto.address,
          school: dto.school,
          notes: dto.notes,
          ...(dto.instructorId !== undefined ? { instructorId: dto.instructorId } : {}),
          status: dto.status,
          registrationDate: dto.registrationDate ? new Date(dto.registrationDate) : undefined,
        },
      });

      if (dto.guardians) {
        await tx.studentParent.deleteMany({ where: { studentId: id } });
        await this.syncGuardians(tx, id, dto.guardians);
      }
    });

    await this.audit.record({
      userId: user.id,
      action: 'STUDENT_UPDATED',
      entity: 'Student',
      entityId: id,
    });

    return this.findOne(user, id);
  }

  async addFamilyMember(user: AuthenticatedUser, studentId: string, memberId: string) {
    this.access.assertCanMutate(user);
    if (studentId === memberId) {
      throw new BadRequestException('Choose another student for the family pack');
    }
    await this.assertExists(studentId);
    await this.assertExists(memberId);

    const [student, member] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: studentId, deletedAt: null },
        select: { id: true, lastName: true, familyId: true },
      }),
      this.prisma.student.findFirst({
        where: { id: memberId, deletedAt: null },
        select: { id: true, lastName: true, familyId: true },
      }),
    ]);
    if (!student || !member) throw new NotFoundException('Student not found');
    if (student.familyId && student.familyId === member.familyId) {
      throw new BadRequestException('These students are already in the same family pack');
    }

    await this.prisma.$transaction(async (tx) => {
      let familyId = student.familyId;
      if (!familyId) {
        const family = await tx.family.create({
          data: { name: `${student.lastName} family` },
        });
        familyId = family.id;
        await tx.student.update({ where: { id: student.id }, data: { familyId } });
      }
      const previousFamilyId = member.familyId;
      if (previousFamilyId && previousFamilyId !== familyId) {
        await tx.student.updateMany({
          where: { familyId: previousFamilyId },
          data: { familyId },
        });
        await tx.family.delete({ where: { id: previousFamilyId } });
      } else {
        await tx.student.update({ where: { id: member.id }, data: { familyId } });
      }
    });

    return this.findOne(user, studentId);
  }

  async leaveFamily(user: AuthenticatedUser, studentId: string) {
    this.access.assertCanMutate(user);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { familyId: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!student.familyId) return this.findOne(user, studentId);

    const familyId = student.familyId;
    await this.prisma.student.update({ where: { id: studentId }, data: { familyId: null } });
    const remaining = await this.prisma.student.count({ where: { familyId, deletedAt: null } });
    if (remaining <= 1) {
      await this.prisma.student.updateMany({ where: { familyId }, data: { familyId: null } });
      await this.prisma.family.delete({ where: { id: familyId } });
    }
    return this.findOne(user, studentId);
  }

  async archive(user: AuthenticatedUser, id: string) {
    this.access.assertCanMutate(user);
    await this.assertExists(id);

    await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    await this.audit.record({
      userId: user.id,
      action: 'STUDENT_ARCHIVED',
      entity: 'Student',
      entityId: id,
    });
  }

  private async assertExists(id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
  }

  private async syncGuardians(
    tx: Prisma.TransactionClient,
    studentId: string,
    guardians: CreateStudentRequest['guardians'],
  ) {
    if (!guardians?.length) return;

    const existingParents = await tx.parent.findMany({
      where: { deletedAt: null },
      select: { id: true, phone: true },
    });
    const parentIdByPhone = new Map<string, string>();
    for (const parent of existingParents) {
      const key = phoneKey(parent.phone);
      if (key && !parentIdByPhone.has(key)) parentIdByPhone.set(key, parent.id);
    }

    const linked = new Set<string>();
    for (const [index, guardian] of guardians.entries()) {
      const key = phoneKey(guardian.phone);
      let parentId = key ? parentIdByPhone.get(key) : undefined;
      if (!parentId) {
        const parent = await tx.parent.create({
          data: {
            firstName: guardian.firstName.trim(),
            lastName: guardian.lastName.trim(),
            phone: guardian.phone,
            email: guardian.email?.toLowerCase(),
          },
        });
        parentId = parent.id;
        if (key) parentIdByPhone.set(key, parentId);
      }
      if (linked.has(parentId)) continue;
      linked.add(parentId);

      await tx.studentParent.create({
        data: {
          studentId,
          parentId,
          relationship: guardian.relationship,
          isPrimary: index === 0,
        },
      });
    }
  }

  private toFamily(
    family: {
      id: string;
      name: string;
      students: Array<{
        id: string;
        firstName: string;
        lastName: string;
        enrollments: Array<{ id: string }>;
      }>;
    } | null,
  ): StudentFamily | null {
    if (!family) return null;
    return {
      id: family.id,
      name: family.name,
      members: family.students.map((member) => ({
        id: member.id,
        fullName: `${member.firstName} ${member.lastName}`,
        enrolled: member.enrollments.length > 0,
      })),
    };
  }

  private toListItem(student: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date | null;
    age: number | null;
    phone: string | null;
    email: string | null;
    status: StudentListItem['status'];
    registrationDate: Date;
    parents: Array<{ parent: { firstName: string; lastName: string } }>;
    enrollments: Array<{ group: { name: string; course: { name: string } } }>;
    invoices: Array<{ status: string; remainingAmount: Prisma.Decimal }>;
  }): StudentListItem {
    const activeEnrollment = student.enrollments[0];
    const guardian = student.parents[0]?.parent;

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      age: this.resolveAge(student.dateOfBirth, student.age),
      phone: student.phone,
      email: student.email,
      status: student.status,
      guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
      activeCourse: activeEnrollment?.group.course.name ?? null,
      activeGroup: activeEnrollment?.group.name ?? null,
      paymentStatus: this.resolvePaymentStatus(student.invoices),
      registrationDate: student.registrationDate.toISOString().slice(0, 10),
    };
  }

  private toProfile(student: StudentWithRelations & {
    attendances: Array<{
      id: string;
      status: string;
      classSession: { sessionDate: Date; group: { name: string } };
    }>;
    payments: Array<{ id: string; amount: Prisma.Decimal; method: string; paymentDate: Date }>;
    certificates: Array<{ id: string; certificateCode: string; issuedDate: Date; course: { name: string } }>;
    family: {
      id: string;
      name: string;
      students: Array<{
        id: string;
        firstName: string;
        lastName: string;
        enrollments: Array<{ id: string }>;
      }>;
    } | null;
    instructor: { firstName: string; lastName: string } | null;
  }, user: AuthenticatedUser): StudentProfileResponse {
    const activeEnrollment = student.enrollments.find((e) => e.status === 'ACTIVE');

    const profile: StudentProfileResponse = {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`,
        dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        age: this.resolveAge(student.dateOfBirth, student.age),
        gender: student.gender,
        phone: student.phone,
        email: student.email,
        address: student.address,
        school: student.school,
        notes: student.notes,
        instructorId: student.instructorId,
        instructorName: student.instructor
          ? `${student.instructor.firstName} ${student.instructor.lastName}`
          : null,
        status: student.status,
        registrationDate: student.registrationDate.toISOString().slice(0, 10),
        createdAt: student.createdAt.toISOString(),
        updatedAt: student.updatedAt.toISOString(),
      },
      guardians: student.parents.map((link) => ({
        id: link.parent.id,
        firstName: link.parent.firstName,
        lastName: link.parent.lastName,
        phone: link.parent.phone ?? undefined,
        email: link.parent.email ?? undefined,
        relationship: link.relationship,
      })),
      family: this.toFamily(student.family),
      activeEnrollment: activeEnrollment
        ? this.mapEnrollment(activeEnrollment)
        : null,
      enrollments: student.enrollments.map((e) => this.mapEnrollment(e)),
      attendance: student.attendances.map((record) => ({
        id: record.id,
        sessionDate: record.classSession.sessionDate.toISOString().slice(0, 10),
        groupName: record.classSession.group.name,
        status: record.status,
      })),
    };

    if (this.access.canViewFinancial(user)) {
      profile.invoices = student.invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: Number(invoice.total).toFixed(2),
        remainingAmount: Number(invoice.remainingAmount).toFixed(2),
        status: invoice.status,
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
      }));
      profile.payments = student.payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount).toFixed(2),
        method: payment.method,
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      }));
      profile.certificates = student.certificates.map((cert) => ({
        id: cert.id,
        courseName: cert.course.name,
        certificateCode: cert.certificateCode,
        issuedDate: cert.issuedDate.toISOString().slice(0, 10),
      }));
    }

    return profile;
  }

  private mapEnrollment(enrollment: StudentWithRelations['enrollments'][number]) {
    return {
      id: enrollment.id,
      groupId: enrollment.groupId,
      groupName: enrollment.group.name,
      courseId: enrollment.group.courseId,
      courseName: enrollment.group.course.name,
      status: enrollment.status,
      startDate: enrollment.startDate.toISOString().slice(0, 10),
      endDate: enrollment.endDate?.toISOString().slice(0, 10) ?? null,
    };
  }

  private resolveAge(dateOfBirth: Date | null | undefined, storedAge: number | null | undefined): number | null {
    if (storedAge != null) return storedAge;
    return this.calculateAge(dateOfBirth);
  }

  private async assertInstructor(instructorId: string | null | undefined) {
    if (!instructorId) return;
    const instructor = await this.prisma.instructor.findFirst({
      where: { id: instructorId, deletedAt: null },
      select: { id: true },
    });
    if (!instructor) {
      throw new BadRequestException('Instructor not found');
    }
  }

  private calculateAge(dateOfBirth: Date | null | undefined): number | null {
    if (!dateOfBirth) return null;
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age -= 1;
    }
    return age;
  }

  private resolvePaymentStatus(
    invoices: Array<{ status: string; remainingAmount: Prisma.Decimal }>,
  ): StudentPaymentStatus {
    if (!invoices.length) return 'NONE';
    const hasOutstanding = invoices.some(
      (invoice) =>
        ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) &&
        Number(invoice.remainingAmount) > 0,
    );
    if (!hasOutstanding) return 'PAID';
    const hasPartial = invoices.some((invoice) => invoice.status === 'PARTIALLY_PAID');
    return hasPartial ? 'PARTIAL' : 'UNPAID';
  }

  private importErrorMessage(error: unknown) {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message?: string | string[] }).message;
        if (Array.isArray(message)) return message.join(', ');
        if (message) return message;
      }
    }

    return error instanceof Error ? error.message : 'Could not create this student';
  }
}

function phoneKey(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '') ?? '';
  return digits.length >= 8 ? digits.slice(-8) : null;
}
