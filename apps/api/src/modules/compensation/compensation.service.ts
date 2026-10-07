import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CompensationCalculationLine,
  CompensationLookups,
  CompensationPreview,
  CompensationRecord,
  CompensationListResponse,
  CompensationRule,
  CompensationRuleListResponse,
  CompensationStatus,
  CompensationType,
} from '@unity/types';
import { CompensationCalculationType, CompensationStatus as PrismaCompensationStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type {
  AdjustCompensationDto,
  CalculateCompensationDto,
  CreateCompensationRuleDto,
  ListCompensationQueryDto,
  UpdateCompensationRuleDto,
  UpdateCompensationStatusDto,
} from './dto/compensation.dto';

const ZERO = new Prisma.Decimal(0);

type RuleRecord = Prisma.InstructorCompensationRuleGetPayload<{
  include: { instructor: true; course: true; group: true };
}>;

@Injectable()
export class CompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async lookups(): Promise<CompensationLookups> {
    const [instructors, courses, groups] = await Promise.all([
      this.prisma.instructor.findMany({
        where: { deletedAt: null },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.course.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.group.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, courseId: true, instructorId: true },
      }),
    ]);

    return {
      instructors: instructors.map((item) => ({
        id: item.id,
        name: `${item.firstName} ${item.lastName}`,
      })),
      courses,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        courseId: group.courseId,
        instructorId: group.instructorId,
      })),
    };
  }

  async listRules(query: ListCompensationQueryDto): Promise<CompensationRuleListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.InstructorCompensationRuleWhereInput = {
      deletedAt: null,
      ...(query.instructorId ? { instructorId: query.instructorId } : {}),
    };

    const [total, rules] = await Promise.all([
      this.prisma.instructorCompensationRule.count({ where }),
      this.prisma.instructorCompensationRule.findMany({
        where,
        orderBy: { effectiveFrom: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { instructor: true, course: true, group: true },
      }),
    ]);

    return {
      data: rules.map((rule) => this.toRule(rule)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async createRule(user: AuthenticatedUser, dto: CreateCompensationRuleDto): Promise<CompensationRule> {
    this.assertRuleValues(dto.type, dto);
    await this.assertRuleScope(dto.instructorId, dto.courseId, dto.groupId);
    if (dto.effectiveUntil && new Date(dto.effectiveUntil) < new Date(dto.effectiveFrom)) {
      throw new BadRequestException('Effective until must be on or after effective from');
    }
    const rule = await this.prisma.instructorCompensationRule.create({
      data: {
        instructorId: dto.instructorId,
        courseId: dto.courseId,
        groupId: dto.groupId,
        type: dto.type,
        percentage: dto.percentage !== undefined ? new Prisma.Decimal(dto.percentage) : undefined,
        fixedAmount: dto.fixedAmount !== undefined ? new Prisma.Decimal(dto.fixedAmount) : undefined,
        amountPerStudent: dto.amountPerStudent !== undefined ? new Prisma.Decimal(dto.amountPerStudent) : undefined,
        hourlyRate: dto.hourlyRate !== undefined ? new Prisma.Decimal(dto.hourlyRate) : undefined,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : undefined,
      },
      include: { instructor: true, course: true, group: true },
    });

    await this.audit.record({
      userId: user.id,
      action: 'COMPENSATION_CREATED',
      entity: 'InstructorCompensationRule',
      entityId: rule.id,
      newValue: { instructorId: dto.instructorId, type: dto.type },
    });

    return this.toRule(rule);
  }

  async updateRule(user: AuthenticatedUser, id: string, dto: UpdateCompensationRuleDto): Promise<CompensationRule> {
    const existing = await this.prisma.instructorCompensationRule.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Compensation rule not found');

    const nextType = dto.type ?? existing.type;
    await this.assertRuleScope(
      existing.instructorId,
      dto.courseId === undefined ? existing.courseId ?? undefined : dto.courseId,
      dto.groupId === undefined ? existing.groupId ?? undefined : dto.groupId,
    );
    this.assertRuleValues(nextType, {
      percentage: dto.percentage ?? this.toNumber(existing.percentage),
      fixedAmount: dto.fixedAmount ?? this.toNumber(existing.fixedAmount),
      amountPerStudent: dto.amountPerStudent ?? this.toNumber(existing.amountPerStudent),
      hourlyRate: dto.hourlyRate ?? this.toNumber(existing.hourlyRate),
    });

    const nextFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const nextUntil = dto.effectiveUntil ? new Date(dto.effectiveUntil) : existing.effectiveUntil;
    if (nextUntil && nextUntil < nextFrom) {
      throw new BadRequestException('Effective until must be on or after effective from');
    }

    const rule = await this.prisma.instructorCompensationRule.update({
      where: { id },
      data: {
        courseId: dto.courseId,
        groupId: dto.groupId,
        type: dto.type,
        percentage: dto.percentage !== undefined ? new Prisma.Decimal(dto.percentage) : undefined,
        fixedAmount: dto.fixedAmount !== undefined ? new Prisma.Decimal(dto.fixedAmount) : undefined,
        amountPerStudent: dto.amountPerStudent !== undefined ? new Prisma.Decimal(dto.amountPerStudent) : undefined,
        hourlyRate: dto.hourlyRate !== undefined ? new Prisma.Decimal(dto.hourlyRate) : undefined,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : undefined,
      },
      include: { instructor: true, course: true, group: true },
    });

    await this.audit.record({
      userId: user.id,
      action: 'COMPENSATION_UPDATED',
      entity: 'InstructorCompensationRule',
      entityId: id,
    });

    return this.toRule(rule);
  }

  async archiveRule(user: AuthenticatedUser, id: string) {
    const existing = await this.prisma.instructorCompensationRule.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Compensation rule not found');

    await this.prisma.instructorCompensationRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      userId: user.id,
      action: 'ARCHIVE',
      entity: 'InstructorCompensationRule',
      entityId: id,
    });
  }

  async calculate(dto: CalculateCompensationDto): Promise<CompensationPreview> {
    const { from, to, period } = this.parsePeriod(dto.period);
    const instructor = await this.prisma.instructor.findFirst({
      where: { id: dto.instructorId, deletedAt: null },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');

    const assignedGroups = await this.prisma.group.findMany({
      where: {
        instructorId: instructor.id,
        deletedAt: null,
        status: { in: ['ACTIVE', 'PLANNED', 'COMPLETED'] },
      },
      include: { course: true },
    });

    const rules = await this.prisma.instructorCompensationRule.findMany({
      where: {
        instructorId: instructor.id,
        deletedAt: null,
        effectiveFrom: { lte: to },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: from } }],
      },
    });

    const existing = await this.prisma.instructorCompensation.findMany({
      where: { instructorId: instructor.id, period },
    });
    const existingByGroup = new Map(existing.map((item) => [item.groupId, item]));

    const assignedIds = new Set(assignedGroups.map((group) => group.id));
    const extraGroupIds = existing
      .map((item) => item.groupId)
      .filter((groupId) => !assignedIds.has(groupId));
    const extraGroups =
      extraGroupIds.length > 0
        ? await this.prisma.group.findMany({
            where: { id: { in: extraGroupIds } },
            include: { course: true },
          })
        : [];

    const groups = [...assignedGroups, ...extraGroups];
    const lines: CompensationCalculationLine[] = [];

    for (const group of groups) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          groupId: group.id,
          deletedAt: null,
          billingEnabled: true,
          status: { in: ['ACTIVE', 'PENDING', 'COMPLETED'] },
          startDate: { lte: to },
          OR: [{ endDate: null }, { endDate: { gte: from } }],
        },
      });

      const sessions = await this.prisma.classSession.findMany({
        where: {
          groupId: group.id,
          sessionDate: { gte: from, lte: to },
          status: { in: ['SCHEDULED', 'COMPLETED'] },
        },
      });

      const stored = existingByGroup.get(group.id);
      const overlaps =
        (!group.startDate || group.startDate <= to) && (!group.endDate || group.endDate >= from);
      const hasActivity = enrollments.length > 0 || sessions.length > 0;
      if (!overlaps && !hasActivity && !stored) continue;

      if (stored && this.isLocked(stored.status)) {
        lines.push(this.lineFromStored(group, stored));
        continue;
      }

      const grossRevenue = enrollments.reduce((sum, enrollment) => {
        return sum.plus(enrollment.agreedMonthlyPrice).minus(enrollment.discountAmount);
      }, ZERO);
      const hoursTaught = sessions.reduce((sum, session) => {
        return sum.plus(this.hoursBetween(session.startTime, session.endTime));
      }, ZERO);
      const studentCount = enrollments.length;
      const rule = this.matchRule(rules, group.id, group.courseId);
      const calculated = this.calculateAmount(rule?.type ?? null, {
        grossRevenue,
        studentCount,
        hoursTaught,
        percentage: rule?.percentage ?? null,
        fixedAmount: rule?.fixedAmount ?? null,
        amountPerStudent: rule?.amountPerStudent ?? null,
        hourlyRate: rule?.hourlyRate ?? null,
      });
      const adjustments = stored?.adjustments ?? ZERO;
      const finalAmount = calculated.plus(adjustments);

      lines.push({
        groupId: group.id,
        groupName: group.name,
        courseId: group.courseId,
        courseName: group.course.name,
        studentCount,
        hoursTaught: hoursTaught.toFixed(2),
        grossRevenue: grossRevenue.toFixed(2),
        ruleType: rule ? this.toApiType(rule.type) : null,
        ruleLabel: this.ruleLabel(rule?.type ?? null, rule),
        percentage: this.moneyOrNull(rule?.percentage ?? null),
        fixedAmount: this.moneyOrNull(rule?.fixedAmount ?? null),
        amountPerStudent: this.moneyOrNull(rule?.amountPerStudent ?? null),
        hourlyRate: this.moneyOrNull(rule?.hourlyRate ?? null),
        calculatedAmount: calculated.toFixed(2),
        adjustments: adjustments.toFixed(2),
        adjustmentReason: stored?.adjustmentReason ?? null,
        finalAmount: finalAmount.toFixed(2),
        existingCompensationId: stored?.id ?? null,
        existingStatus: stored ? this.toApiStatus(stored.status) : null,
        locked: false,
      });
    }

    return {
      instructorId: instructor.id,
      instructorName: `${instructor.firstName} ${instructor.lastName}`,
      period,
      lines,
      totalGrossRevenue: this.sum(lines.map((line) => line.grossRevenue)),
      totalCalculated: this.sum(lines.map((line) => line.calculatedAmount)),
      totalAdjustments: this.sum(lines.map((line) => line.adjustments)),
      totalFinal: this.sum(lines.map((line) => line.finalAmount)),
    };
  }

  async saveSnapshot(user: AuthenticatedUser, dto: CalculateCompensationDto): Promise<CompensationPreview> {
    const preview = await this.calculate(dto);
    const { from, to, period } = this.parsePeriod(dto.period);
    const rules = await this.prisma.instructorCompensationRule.findMany({
      where: {
        instructorId: dto.instructorId,
        deletedAt: null,
        effectiveFrom: { lte: to },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: from } }],
      },
    });

    for (const line of preview.lines) {
      if (line.locked) continue;
      const rule = this.matchRule(rules, line.groupId, line.courseId);
      const type = line.ruleType ?? (rule ? this.toApiType(rule.type) : null);
      if (!type) continue;

      await this.prisma.instructorCompensation.upsert({
        where: {
          instructorId_groupId_period: {
            instructorId: dto.instructorId,
            groupId: line.groupId,
            period,
          },
        },
        create: {
          instructorId: dto.instructorId,
          groupId: line.groupId,
          period,
          periodStart: from,
          periodEnd: to,
          studentCount: line.studentCount,
          hoursTaught: new Prisma.Decimal(line.hoursTaught),
          grossRevenue: new Prisma.Decimal(line.grossRevenue),
          calculationType: type,
          percentage: line.percentage ? new Prisma.Decimal(line.percentage) : undefined,
          fixedAmount: line.fixedAmount ? new Prisma.Decimal(line.fixedAmount) : undefined,
          amountPerStudent: line.amountPerStudent ? new Prisma.Decimal(line.amountPerStudent) : undefined,
          hourlyRate: line.hourlyRate ? new Prisma.Decimal(line.hourlyRate) : undefined,
          calculatedAmount: new Prisma.Decimal(line.calculatedAmount),
          adjustments: new Prisma.Decimal(line.adjustments),
          adjustmentReason: line.adjustmentReason,
          finalAmount: new Prisma.Decimal(line.finalAmount),
          status: 'DRAFT',
        },
        update: {
          studentCount: line.studentCount,
          hoursTaught: new Prisma.Decimal(line.hoursTaught),
          grossRevenue: new Prisma.Decimal(line.grossRevenue),
          calculationType: type,
          percentage: line.percentage ? new Prisma.Decimal(line.percentage) : null,
          fixedAmount: line.fixedAmount ? new Prisma.Decimal(line.fixedAmount) : null,
          amountPerStudent: line.amountPerStudent ? new Prisma.Decimal(line.amountPerStudent) : null,
          hourlyRate: line.hourlyRate ? new Prisma.Decimal(line.hourlyRate) : null,
          calculatedAmount: new Prisma.Decimal(line.calculatedAmount),
          finalAmount: new Prisma.Decimal(line.finalAmount),
        },
      });
    }

    await this.audit.record({
      userId: user.id,
      action: 'COMPENSATION_CREATED',
      entity: 'InstructorCompensation',
      entityId: `${dto.instructorId}:${period}`,
      newValue: { instructorId: dto.instructorId, period, groups: preview.lines.length },
    });

    return this.calculate(dto);
  }

  async list(query: ListCompensationQueryDto): Promise<CompensationListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.InstructorCompensationWhereInput = {
      ...(query.instructorId ? { instructorId: query.instructorId } : {}),
      ...(query.period ? { period: query.period } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, records] = await Promise.all([
      this.prisma.instructorCompensation.count({ where }),
      this.prisma.instructorCompensation.findMany({
        where,
        orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          instructor: true,
          group: { include: { course: true } },
        },
      }),
    ]);

    return {
      data: records.map((record) => this.toRecord(record)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async findOne(id: string): Promise<CompensationRecord> {
    const record = await this.prisma.instructorCompensation.findFirst({
      where: { id },
      include: { instructor: true, group: { include: { course: true } } },
    });
    if (!record) throw new NotFoundException('Compensation record not found');
    return this.toRecord(record);
  }

  async adjust(user: AuthenticatedUser, id: string, dto: AdjustCompensationDto): Promise<CompensationRecord> {
    const existing = await this.prisma.instructorCompensation.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Compensation record not found');
    if (this.isLocked(existing.status)) {
      throw new BadRequestException('Approved or paid compensation cannot be adjusted');
    }

    const adjustments = new Prisma.Decimal(dto.adjustments);
    const finalAmount = existing.calculatedAmount.plus(adjustments);

    await this.prisma.instructorCompensation.update({
      where: { id },
      data: {
        adjustments,
        adjustmentReason: dto.adjustmentReason.trim(),
        finalAmount,
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'COMPENSATION_UPDATED',
      entity: 'InstructorCompensation',
      entityId: id,
      oldValue: {
        adjustments: existing.adjustments.toFixed(2),
        reason: existing.adjustmentReason,
        finalAmount: existing.finalAmount.toFixed(2),
      },
      newValue: {
        adjustments: adjustments.toFixed(2),
        reason: dto.adjustmentReason.trim(),
        finalAmount: finalAmount.toFixed(2),
      },
    });

    return this.findOne(id);
  }

  async updateStatus(user: AuthenticatedUser, id: string, dto: UpdateCompensationStatusDto): Promise<CompensationRecord> {
    const existing = await this.prisma.instructorCompensation.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Compensation record not found');

    const next = dto.status;
    if (next !== 'DRAFT' && next !== 'APPROVED' && next !== 'PAID') {
      throw new BadRequestException('Status must be DRAFT, APPROVED, or PAID');
    }
    if (existing.status === 'PAID' && next !== 'PAID') {
      throw new BadRequestException('Paid compensation cannot be reverted');
    }
    if (next === 'PAID' && existing.status !== 'APPROVED' && existing.status !== 'PAID') {
      throw new BadRequestException('Compensation must be approved before it can be marked paid');
    }

    await this.prisma.instructorCompensation.update({
      where: { id },
      data: { status: next },
    });

    await this.audit.record({
      userId: user.id,
      action: 'COMPENSATION_UPDATED',
      entity: 'InstructorCompensation',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: next },
    });

    return this.findOne(id);
  }

  private async assertRuleScope(instructorId: string, courseId?: string | null, groupId?: string | null) {
    const instructor = await this.prisma.instructor.findFirst({
      where: { id: instructorId, deletedAt: null },
    });
    if (!instructor) throw new NotFoundException('Instructor not found');

    if (courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: courseId, deletedAt: null },
      });
      if (!course) throw new NotFoundException('Course not found');
    }

    if (groupId) {
      const group = await this.prisma.group.findFirst({
        where: { id: groupId, deletedAt: null },
      });
      if (!group) throw new NotFoundException('Group not found');
      if (courseId && group.courseId !== courseId) {
        throw new BadRequestException('Group does not belong to the selected course');
      }
      if (group.instructorId && group.instructorId !== instructorId) {
        throw new BadRequestException('Group is not assigned to this instructor');
      }
    }
  }

  private lineFromStored(
    group: { id: string; name: string; courseId: string; course: { name: string } },
    stored: {
      id: string;
      studentCount: number;
      hoursTaught: Prisma.Decimal;
      grossRevenue: Prisma.Decimal;
      calculationType: CompensationCalculationType;
      percentage: Prisma.Decimal | null;
      fixedAmount: Prisma.Decimal | null;
      amountPerStudent: Prisma.Decimal | null;
      hourlyRate: Prisma.Decimal | null;
      calculatedAmount: Prisma.Decimal;
      adjustments: Prisma.Decimal;
      adjustmentReason: string | null;
      finalAmount: Prisma.Decimal;
      status: PrismaCompensationStatus;
    },
  ): CompensationCalculationLine {
    return {
      groupId: group.id,
      groupName: group.name,
      courseId: group.courseId,
      courseName: group.course.name,
      studentCount: stored.studentCount,
      hoursTaught: stored.hoursTaught.toFixed(2),
      grossRevenue: stored.grossRevenue.toFixed(2),
      ruleType: this.toApiType(stored.calculationType),
      ruleLabel: this.ruleLabel(stored.calculationType, stored),
      percentage: this.moneyOrNull(stored.percentage),
      fixedAmount: this.moneyOrNull(stored.fixedAmount),
      amountPerStudent: this.moneyOrNull(stored.amountPerStudent),
      hourlyRate: this.moneyOrNull(stored.hourlyRate),
      calculatedAmount: stored.calculatedAmount.toFixed(2),
      adjustments: stored.adjustments.toFixed(2),
      adjustmentReason: stored.adjustmentReason,
      finalAmount: stored.finalAmount.toFixed(2),
      existingCompensationId: stored.id,
      existingStatus: this.toApiStatus(stored.status),
      locked: true,
    };
  }

  private matchRule(
    rules: Array<{
      groupId: string | null;
      courseId: string | null;
      type: CompensationCalculationType;
      percentage: Prisma.Decimal | null;
      fixedAmount: Prisma.Decimal | null;
      amountPerStudent: Prisma.Decimal | null;
      hourlyRate: Prisma.Decimal | null;
    }>,
    groupId: string,
    courseId?: string,
  ) {
    const byGroup = rules.find((rule) => rule.groupId === groupId);
    if (byGroup) return byGroup;
    if (courseId) {
      const byCourse = rules.find((rule) => rule.courseId === courseId && !rule.groupId);
      if (byCourse) return byCourse;
    }
    return rules.find((rule) => !rule.courseId && !rule.groupId) ?? null;
  }

  private calculateAmount(
    type: CompensationCalculationType | null,
    input: {
      grossRevenue: Prisma.Decimal;
      studentCount: number;
      hoursTaught: Prisma.Decimal;
      percentage: Prisma.Decimal | null;
      fixedAmount: Prisma.Decimal | null;
      amountPerStudent: Prisma.Decimal | null;
      hourlyRate: Prisma.Decimal | null;
    },
  ): Prisma.Decimal {
    if (!type) return ZERO;
    if (type === 'FIXED') return input.fixedAmount ?? ZERO;
    if (type === 'PERCENTAGE') {
      return input.grossRevenue.mul(input.percentage ?? ZERO).div(100);
    }
    if (type === 'PER_STUDENT') {
      return (input.amountPerStudent ?? ZERO).mul(input.studentCount);
    }
    return (input.hourlyRate ?? ZERO).mul(input.hoursTaught);
  }

  private parsePeriod(period: string) {
    const [yearPart, monthPart] = period.split('-');
    if (!yearPart || !monthPart || yearPart.length !== 4 || monthPart.length !== 2) {
      throw new BadRequestException('Period must be in YYYY-MM format');
    }
    const year = Number.parseInt(yearPart, 10);
    const month = Number.parseInt(monthPart, 10);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Period must be in YYYY-MM format');
    }
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);
    return { from, to, period: `${yearPart}-${monthPart}` };
  }

  private hoursBetween(startTime: string, endTime: string): Prisma.Decimal {
    const [startHour, startMinute] = startTime.split(':').map((part) => Number.parseInt(part, 10));
    const [endHour, endMinute] = endTime.split(':').map((part) => Number.parseInt(part, 10));
    if (
      startHour === undefined ||
      startMinute === undefined ||
      endHour === undefined ||
      endMinute === undefined ||
      Number.isNaN(startHour) ||
      Number.isNaN(startMinute) ||
      Number.isNaN(endHour) ||
      Number.isNaN(endMinute)
    ) {
      return ZERO;
    }
    const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    if (minutes <= 0) return ZERO;
    return new Prisma.Decimal(minutes).div(60);
  }

  private assertRuleValues(
    type: CompensationCalculationType,
    values: {
      percentage?: number | null;
      fixedAmount?: number | null;
      amountPerStudent?: number | null;
      hourlyRate?: number | null;
    },
  ) {
    if (type === 'PERCENTAGE' && (values.percentage === undefined || values.percentage === null)) {
      throw new BadRequestException('Percentage is required for PERCENTAGE rules');
    }
    if (type === 'FIXED' && (values.fixedAmount === undefined || values.fixedAmount === null)) {
      throw new BadRequestException('Fixed amount is required for FIXED rules');
    }
    if (type === 'PER_STUDENT' && (values.amountPerStudent === undefined || values.amountPerStudent === null)) {
      throw new BadRequestException('Amount per student is required for PER_STUDENT rules');
    }
    if (type === 'HOURLY' && (values.hourlyRate === undefined || values.hourlyRate === null)) {
      throw new BadRequestException('Hourly rate is required for HOURLY rules');
    }
  }

  private isLocked(status: PrismaCompensationStatus) {
    return status === 'APPROVED' || status === 'PAID';
  }

  private toApiType(type: CompensationCalculationType): CompensationType {
    return type;
  }

  private toApiStatus(status: PrismaCompensationStatus): CompensationStatus {
    if (status === 'APPROVED' || status === 'PAID') return status;
    return 'DRAFT';
  }

  private toNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
  }

  private moneyOrNull(value: Prisma.Decimal | null): string | null {
    return value ? value.toFixed(2) : null;
  }

  private sum(values: string[]): string {
    return values
      .reduce((total, value) => total.plus(value || 0), ZERO)
      .toFixed(2);
  }

  private ruleLabel(
    type: CompensationCalculationType | null,
    source:
      | {
          percentage?: Prisma.Decimal | null;
          fixedAmount?: Prisma.Decimal | null;
          amountPerStudent?: Prisma.Decimal | null;
          hourlyRate?: Prisma.Decimal | null;
        }
      | null,
  ) {
    if (!type || !source) return 'No rule';
    if (type === 'PERCENTAGE') return `${source.percentage?.toFixed(2) ?? '0.00'}% of revenue`;
    if (type === 'FIXED') return `Fixed EUR ${source.fixedAmount?.toFixed(2) ?? '0.00'}`;
    if (type === 'PER_STUDENT') return `EUR ${source.amountPerStudent?.toFixed(2) ?? '0.00'} per student`;
    return `EUR ${source.hourlyRate?.toFixed(2) ?? '0.00'} / hour`;
  }

  private toRule(rule: RuleRecord): CompensationRule {
    return {
      id: rule.id,
      instructorId: rule.instructorId,
      instructorName: `${rule.instructor.firstName} ${rule.instructor.lastName}`,
      courseId: rule.courseId,
      courseName: rule.course?.name ?? null,
      groupId: rule.groupId,
      groupName: rule.group?.name ?? null,
      type: this.toApiType(rule.type),
      percentage: this.moneyOrNull(rule.percentage),
      fixedAmount: this.moneyOrNull(rule.fixedAmount),
      amountPerStudent: this.moneyOrNull(rule.amountPerStudent),
      hourlyRate: this.moneyOrNull(rule.hourlyRate),
      effectiveFrom: rule.effectiveFrom.toISOString().slice(0, 10),
      effectiveUntil: rule.effectiveUntil?.toISOString().slice(0, 10) ?? null,
    };
  }

  private toRecord(record: {
    id: string;
    instructorId: string;
    groupId: string;
    period: string;
    studentCount: number;
    hoursTaught: Prisma.Decimal;
    grossRevenue: Prisma.Decimal;
    calculationType: CompensationCalculationType;
    percentage: Prisma.Decimal | null;
    fixedAmount: Prisma.Decimal | null;
    amountPerStudent: Prisma.Decimal | null;
    hourlyRate: Prisma.Decimal | null;
    calculatedAmount: Prisma.Decimal;
    adjustments: Prisma.Decimal;
    adjustmentReason: string | null;
    finalAmount: Prisma.Decimal;
    status: PrismaCompensationStatus;
    createdAt: Date;
    updatedAt: Date;
    instructor: { firstName: string; lastName: string };
    group: { name: string; course: { name: string } };
  }): CompensationRecord {
    return {
      id: record.id,
      instructorId: record.instructorId,
      instructorName: `${record.instructor.firstName} ${record.instructor.lastName}`,
      groupId: record.groupId,
      groupName: record.group.name,
      courseName: record.group.course.name,
      period: record.period,
      studentCount: record.studentCount,
      hoursTaught: record.hoursTaught.toFixed(2),
      grossRevenue: record.grossRevenue.toFixed(2),
      calculationType: this.toApiType(record.calculationType),
      percentage: this.moneyOrNull(record.percentage),
      fixedAmount: this.moneyOrNull(record.fixedAmount),
      amountPerStudent: this.moneyOrNull(record.amountPerStudent),
      hourlyRate: this.moneyOrNull(record.hourlyRate),
      calculatedAmount: record.calculatedAmount.toFixed(2),
      adjustments: record.adjustments.toFixed(2),
      adjustmentReason: record.adjustmentReason,
      finalAmount: record.finalAmount.toFixed(2),
      status: this.toApiStatus(record.status),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
