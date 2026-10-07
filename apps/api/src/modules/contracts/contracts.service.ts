import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  EmploymentContractDetail,
  EmploymentContractListItem,
  EmploymentContractListResponse,
  EmploymentContractStatus,
  EmploymentContractType,
} from '@unity/types';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { CreateContractDto, ListContractsQueryDto, UpdateContractDto } from './dto/contract.dto';

const MAX_FIXED_TERM_YEARS = 10;
const MAX_SPECIFIC_TASK_DAYS = 120;
const TYPE_LABELS: Record<EmploymentContractType, string> = {
  INDEFINITE: 'Indefinite term (Neni 10.2.1)',
  FIXED_TERM: 'Fixed term (Neni 10.2.2)',
  SPECIFIC_TASK: 'Specific task (Neni 10.2.3)',
  COLLABORATION: 'Collaboration / percentage agreement',
};
const DEFAULT_PERCENTAGE_BASE =
  'Collected student payments for groups assigned to the collaborator';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: ListContractsQueryDto): Promise<EmploymentContractListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.EmploymentContractWhereInput = {
      deletedAt: null,
      ...(query.employeeUserId ? { employeeUserId: query.employeeUserId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { contractNumber: { contains: query.search, mode: 'insensitive' } },
              { jobTitle: { contains: query.search, mode: 'insensitive' } },
              { employeeFirstName: { contains: query.search, mode: 'insensitive' } },
              { employeeLastName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, contracts] = await Promise.all([
      this.prisma.employmentContract.count({ where }),
      this.prisma.employmentContract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { employee: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return {
      data: contracts.map((contract) => this.toListItem(this.withEffectiveStatus(contract))),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async findOne(id: string): Promise<EmploymentContractDetail> {
    const contract = await this.prisma.employmentContract.findFirst({
      where: { id, deletedAt: null },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return this.toDetail(this.withEffectiveStatus(contract));
  }

  async create(user: AuthenticatedUser, dto: CreateContractDto): Promise<EmploymentContractDetail> {
    await this.assertEmployee(dto.employeeUserId, dto.type);
    this.assertLegalTerms(dto);

    const created = await this.prisma.employmentContract.create({
      data: {
        contractNumber: await this.nextContractNumber(),
        createdById: user.id,
        employeeUserId: dto.employeeUserId,
        type: dto.type,
        timeType: dto.timeType,
        employerName: dto.employerName.trim(),
        employerSeat: dto.employerSeat.trim(),
        employerRegistrationNumber: dto.employerRegistrationNumber.trim(),
        employeeFirstName: dto.employeeFirstName.trim(),
        employeeLastName: dto.employeeLastName.trim(),
        employeeQualification: dto.employeeQualification.trim(),
        employeeResidence: dto.employeeResidence.trim(),
        employeePersonalNumber: dto.employeePersonalNumber?.trim() || null,
        jobTitle: dto.jobTitle.trim(),
        jobNature: dto.jobNature.trim(),
        jobDescription: dto.jobDescription.trim(),
        workplace: dto.workplace.trim(),
        workInMultipleLocations: dto.workInMultipleLocations ?? false,
        weeklyHours: dto.weeklyHours,
        workSchedule: dto.workSchedule.trim(),
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        baseSalary: new Prisma.Decimal(dto.baseSalary ?? 0),
        collaborationPercentage:
          dto.type === 'COLLABORATION' ? new Prisma.Decimal(dto.collaborationPercentage ?? 0) : null,
        percentageBase:
          dto.type === 'COLLABORATION'
            ? dto.percentageBase?.trim() || DEFAULT_PERCENTAGE_BASE
            : dto.percentageBase?.trim() || null,
        allowances: dto.allowances?.trim() || null,
        paymentDay: dto.paymentDay ?? null,
        annualLeaveDays: dto.annualLeaveDays,
        noticePeriodDays: dto.noticePeriodDays,
        terminationTerms: dto.terminationTerms?.trim() || null,
        probationMonths: dto.probationMonths ?? 0,
        agreedTerms: dto.agreedTerms?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: 'DRAFT',
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'CREATE',
      entity: 'EmploymentContract',
      entityId: created.id,
      newValue: { contractNumber: created.contractNumber },
    });

    return this.findOne(created.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateContractDto): Promise<EmploymentContractDetail> {
    const existing = await this.prisma.employmentContract.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Contract not found');
    if (existing.status === 'TERMINATED') {
      throw new BadRequestException('Terminated contracts cannot be edited');
    }

    if (dto.employeeUserId || dto.type) {
      await this.assertEmployee(dto.employeeUserId ?? existing.employeeUserId, dto.type ?? existing.type);
    }

    const merged = {
      type: dto.type ?? existing.type,
      startDate: dto.startDate ?? existing.startDate.toISOString().slice(0, 10),
      endDate: dto.endDate === undefined ? existing.endDate?.toISOString().slice(0, 10) : dto.endDate,
      weeklyHours: dto.weeklyHours ?? existing.weeklyHours,
      annualLeaveDays: dto.annualLeaveDays ?? existing.annualLeaveDays,
      noticePeriodDays: dto.noticePeriodDays ?? existing.noticePeriodDays,
      probationMonths: dto.probationMonths ?? existing.probationMonths,
      baseSalary: dto.baseSalary ?? Number(existing.baseSalary),
      collaborationPercentage:
        dto.collaborationPercentage ??
        (existing.collaborationPercentage ? Number(existing.collaborationPercentage) : undefined),
    };
    this.assertLegalTerms(merged);

    const nextStatus = this.resolveStatus(existing.status, dto.status);
    await this.prisma.employmentContract.update({
      where: { id },
      data: {
        ...this.toPersistData({
          ...dto,
          type: merged.type,
          startDate: merged.startDate,
          endDate: merged.endDate,
        }),
        ...(merged.type === 'INDEFINITE' ? { endDate: null } : {}),
        status: nextStatus,
        issuedAt: nextStatus === 'ISSUED' && !existing.issuedAt ? new Date() : existing.issuedAt,
        signedAt: nextStatus === 'ACTIVE' && !existing.signedAt ? new Date() : existing.signedAt,
        terminatedAt: nextStatus === 'TERMINATED' && !existing.terminatedAt ? new Date() : existing.terminatedAt,
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'UPDATE',
      entity: 'EmploymentContract',
      entityId: id,
    });

    return this.findOne(id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    const existing = await this.prisma.employmentContract.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Contract not found');

    await this.prisma.employmentContract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      userId: user.id,
      action: 'ARCHIVE',
      entity: 'EmploymentContract',
      entityId: id,
    });
  }

  async generatePdf(id: string): Promise<Buffer> {
    const contract = await this.findOne(id);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (contract.type === 'COLLABORATION') {
        this.writeCollaborationPdf(doc, contract);
        doc.end();
        return;
      }

      doc.fontSize(16).font('Helvetica-Bold').text('EMPLOYMENT CONTRACT', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text('Kontrata e Punes', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor('#444444').text(
        'Prepared pursuant to Law No. 03/L-212 on Labour of the Republic of Kosovo, Articles 10, 11 and 15.',
        { align: 'center' },
      );
      doc.fillColor('#000000').moveDown(0.8);
      doc.fontSize(10).text(`Contract number: ${contract.contractNumber}`);
      doc.text(`Type: ${TYPE_LABELS[contract.type]}`);
      doc.text(`Status: ${contract.status}`);
      doc.moveDown(0.8);

      this.section(doc, '1. Employer  (Neni 11.1.1)');
      doc.text(`Name: ${contract.employerName}`);
      doc.text(`Seat: ${contract.employerSeat}`);
      doc.text(`Business registration number: ${contract.employerRegistrationNumber}`);

      this.section(doc, '2. Employee  (Neni 11.1.2)');
      doc.text(`Name: ${contract.employeeFirstName} ${contract.employeeLastName}`);
      doc.text(`Qualification: ${contract.employeeQualification}`);
      doc.text(`Residence: ${contract.employeeResidence}`);
      if (contract.employeePersonalNumber) {
        doc.text(`Personal number: ${contract.employeePersonalNumber}`);
      }

      this.section(doc, '3. Job and duties  (Neni 11.1.3)');
      doc.text(`Job title: ${contract.jobTitle}`);
      doc.text(`Nature / type of work: ${contract.jobNature}`);
      doc.text(`Duties: ${contract.jobDescription}`);

      this.section(doc, '4. Place of work  (Neni 11.1.4)');
      doc.text(`Workplace: ${contract.workplace}`);
      doc.text(
        `Work in different locations: ${contract.workInMultipleLocations ? 'Yes, as required by the employer' : 'No, primarily at the workplace above'}`,
      );

      this.section(doc, '5. Working hours  (Neni 11.1.5)');
      doc.text(`Engagement: ${contract.timeType === 'FULL_TIME' ? 'Full-time' : 'Part-time'}`);
      doc.text(`Weekly hours: ${contract.weeklyHours} (standard full-time under the Law is 40 hours)`);
      doc.text(`Schedule: ${contract.workSchedule}`);

      this.section(doc, '6. Duration  (Neni 10 and 11.1.6-11.1.7)');
      doc.text(`Start date: ${contract.startDate}`);
      if (contract.type === 'INDEFINITE') {
        doc.text('Duration: Indefinite term. If duration is not specified, the Law treats the contract as indefinite.');
      } else {
        doc.text(`End date: ${contract.endDate ?? '—'}`);
        if (contract.type === 'FIXED_TERM') {
          doc.text('A fixed-term contract may not exceed ten (10) years (Neni 10.4).');
        }
        if (contract.type === 'SPECIFIC_TASK') {
          doc.text('A specific-task contract may not exceed one hundred and twenty (120) days in one year (Neni 10.6).');
        }
      }

      this.section(doc, '7. Salary  (Neni 11.1.8)');
      doc.text(`Base salary: EUR ${contract.baseSalary} per month`);
      doc.text(`Allowances / other income: ${contract.allowances || 'None agreed beyond the base salary.'}`);
      doc.text(`Payment day: ${contract.paymentDay ? `Day ${contract.paymentDay} of each month` : 'As agreed by the parties, no later than the end of the month.'}`);

      this.section(doc, '8. Annual leave  (Neni 11.1.9)');
      if (contract.type === 'SPECIFIC_TASK') {
        doc.text('Specific-task employees are not entitled to annual leave under Neni 10.8, unless otherwise agreed.');
      } else {
        doc.text(`Annual leave: ${contract.annualLeaveDays} working days (not less than the legal minimum of 20 working days).`);
      }

      this.section(doc, '9. Probation  (Neni 15)');
      if (contract.probationMonths > 0) {
        doc.text(`Probation: ${contract.probationMonths} month(s), not exceeding six (6) months.`);
        doc.text('During probation, either party may terminate the employment with seven (7) days prior notice.');
      } else {
        doc.text('No probation period was agreed.');
      }

      this.section(doc, '10. Termination  (Neni 11.1.10, 67-71)');
      doc.text(`Contractual notice period: ${contract.noticePeriodDays} calendar days, without reducing the minimum periods in the Law.`);
      doc.text(
        'The employee may resign with 15 days notice on a fixed-term contract or 30 days on an indefinite contract (Neni 69).',
      );
      doc.text(
        'The employer may terminate an indefinite contract with 30, 45 or 60 days notice depending on length of service (Neni 71).',
      );
      if (contract.terminationTerms) {
        doc.text(`Additional termination terms: ${contract.terminationTerms}`);
      }

      this.section(doc, '11. Terms agreed in discussion  (Neni 11.1.11)');
      doc.text(
        contract.agreedTerms?.trim() ||
          'No additional terms were agreed beyond the mandatory elements of this contract and the Law.',
      );

      this.section(doc, '12. Other rights and duties  (Neni 11.1.12-11.1.13)');
      doc.text(
        'Rights and duties not specified here are governed by Law No. 03/L-212, any applicable collective agreement, and the employer internal act.',
      );

      doc.moveDown(1.4);
      doc.text(`Place and date: ${contract.employerSeat}, ${contract.startDate}`);
      doc.moveDown(1.6);
      doc.text('Employer signature                              Employee signature');
      doc.moveDown(2);
      doc.text('____________________________                    ____________________________');
      doc.text(contract.employerName);
      doc.text(`${contract.employeeFirstName} ${contract.employeeLastName}`, 320, doc.y - 14);

      doc.moveDown(2);
      doc.fontSize(8).fillColor('#666666').text(
        'This document is generated for Unity Tech Hub. It is a working draft based on Kosovo Labour Law and does not replace legal review before signing.',
        { align: 'center' },
      );

      doc.end();
    });
  }

  private section(doc: InstanceType<typeof PDFDocument>, title: string) {
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(11).text(title);
    doc.font('Helvetica').fontSize(10);
  }

  private writeCollaborationPdf(
    doc: InstanceType<typeof PDFDocument>,
    contract: EmploymentContractDetail,
  ) {
    doc.fontSize(16).font('Helvetica-Bold').text('COLLABORATION AGREEMENT', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text('Marreveshje Bashkepunimi', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#444444').text(
      'Independent teaching collaboration. This is not an employment contract under Law No. 03/L-212.',
      { align: 'center' },
    );
    doc.fillColor('#000000').moveDown(0.8);
    doc.fontSize(10).text(`Agreement number: ${contract.contractNumber}`);
    doc.text(`Type: ${TYPE_LABELS[contract.type]}`);
    doc.text(`Status: ${contract.status}`);
    doc.moveDown(0.8);

    this.section(doc, '1. Company');
    doc.text(`Name: ${contract.employerName}`);
    doc.text(`Seat: ${contract.employerSeat}`);
    doc.text(`Business registration number: ${contract.employerRegistrationNumber}`);

    this.section(doc, '2. Collaborator');
    doc.text(`Name: ${contract.employeeFirstName} ${contract.employeeLastName}`);
    doc.text(`Qualification: ${contract.employeeQualification}`);
    doc.text(`Residence: ${contract.employeeResidence}`);
    if (contract.employeePersonalNumber) {
      doc.text(`Personal number: ${contract.employeePersonalNumber}`);
    }

    this.section(doc, '3. Services');
    doc.text(`Role: ${contract.jobTitle}`);
    doc.text(`Nature of work: ${contract.jobNature}`);
    doc.text(`Services: ${contract.jobDescription}`);
    doc.text(`Place of work: ${contract.workplace}`);
    if (contract.weeklyHours > 0) {
      doc.text(`Expected teaching load: about ${contract.weeklyHours} hours per week`);
    }
    doc.text(`Schedule: ${contract.workSchedule}`);

    this.section(doc, '4. Duration');
    doc.text(`Start date: ${contract.startDate}`);
    doc.text(contract.endDate ? `End date: ${contract.endDate}` : 'Duration: open-ended, until terminated by either party.');

    this.section(doc, '5. Compensation');
    doc.text(
      `The collaborator is paid ${contract.collaborationPercentage ?? '—'}% of ${
        contract.percentageBase || DEFAULT_PERCENTAGE_BASE
      }.`,
    );
    doc.text(
      'Payment is calculated from amounts actually collected, based on the percentage agreed for this collaborator.',
    );
    if (Number(contract.baseSalary) > 0) {
      doc.text(`Guaranteed minimum: EUR ${contract.baseSalary} per month, if agreed.`);
    }
    if (contract.allowances) {
      doc.text(`Other agreed amounts: ${contract.allowances}`);
    }
    doc.text(
      `Payment day: ${
        contract.paymentDay
          ? `Day ${contract.paymentDay} of the month after collection`
          : 'As agreed after student payments are collected'
      }.`,
    );

    this.section(doc, '6. Termination');
    doc.text(
      contract.noticePeriodDays > 0
        ? `Either party may end this collaboration with ${contract.noticePeriodDays} days prior notice.`
        : 'Either party may end this collaboration as agreed in the discussion terms.',
    );
    if (contract.terminationTerms) {
      doc.text(`Additional termination terms: ${contract.terminationTerms}`);
    }

    this.section(doc, '7. Terms agreed in discussion');
    doc.text(
      contract.agreedTerms?.trim() ||
        'No additional terms were agreed beyond the percentage and services stated above.',
    );

    this.section(doc, '8. Legal nature');
    doc.text(
      'The collaborator is engaged as an independent partner for teaching services. This agreement does not create an employment relationship, paid leave, or probation unless separately agreed in writing.',
    );

    doc.moveDown(1.4);
    doc.text(`Place and date: ${contract.employerSeat}, ${contract.startDate}`);
    doc.moveDown(1.6);
    doc.text('Company signature                              Collaborator signature');
    doc.moveDown(2);
    doc.text('____________________________                    ____________________________');
    doc.text(contract.employerName);
    doc.text(`${contract.employeeFirstName} ${contract.employeeLastName}`, 320, doc.y - 14);

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#666666').text(
      'This document is generated for Unity Tech Hub. It is a working draft and does not replace legal review before signing.',
      { align: 'center' },
    );
  }

  private assertLegalTerms(input: {
    type: EmploymentContractType;
    startDate: string;
    endDate?: string | null;
    weeklyHours: number;
    annualLeaveDays: number;
    noticePeriodDays: number;
    probationMonths?: number;
    baseSalary?: number;
    collaborationPercentage?: number;
  }) {
    if (input.weeklyHours > 40) {
      throw new BadRequestException('Regular weekly hours cannot exceed 40 under Kosovo Labour Law');
    }

    const start = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null;
    if (end && end < start) {
      throw new BadRequestException('End date cannot be earlier than start date');
    }

    if (input.type === 'COLLABORATION') {
      if (!input.collaborationPercentage || input.collaborationPercentage <= 0) {
        throw new BadRequestException('Collaboration agreements require a percentage greater than 0');
      }
      if (input.collaborationPercentage > 100) {
        throw new BadRequestException('Collaboration percentage cannot exceed 100');
      }
      return;
    }

    if ((input.baseSalary ?? 0) <= 0) {
      throw new BadRequestException('Employment contracts require a monthly salary');
    }
    if ((input.probationMonths ?? 0) > 6) {
      throw new BadRequestException('Probation cannot exceed 6 months (Neni 15)');
    }
    if (input.annualLeaveDays < 20 && input.type !== 'SPECIFIC_TASK') {
      throw new BadRequestException('Annual leave cannot be below 20 working days');
    }
    if (input.noticePeriodDays < 7) {
      throw new BadRequestException('Notice period cannot be below 7 days');
    }

    if (input.type === 'INDEFINITE' && end) {
      throw new BadRequestException('Indefinite contracts must not have an end date');
    }

    if (input.type !== 'INDEFINITE') {
      if (!end) {
        throw new BadRequestException('End date is required for this contract type');
      }
      const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      if (input.type === 'FIXED_TERM' && days > MAX_FIXED_TERM_YEARS * 366) {
        throw new BadRequestException('Fixed-term contracts cannot exceed 10 years (Neni 10.4)');
      }
      if (input.type === 'SPECIFIC_TASK' && days > MAX_SPECIFIC_TASK_DAYS) {
        throw new BadRequestException('Specific-task contracts cannot exceed 120 days in one year (Neni 10.6)');
      }
    }
  }

  private async assertEmployee(userId: string, type?: EmploymentContractType) {
    const employee = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!employee) throw new NotFoundException('Employee user not found');
    const roleNames = employee.roles.map((item) => item.role.name);
    if (type === 'COLLABORATION') {
      if (!roleNames.includes('INSTRUCTOR')) {
        throw new BadRequestException('Collaboration agreements can be created only for instructors');
      }
      return;
    }
    if (!roleNames.includes('ADMIN') && !roleNames.includes('INSTRUCTOR')) {
      throw new BadRequestException('Contracts can be created only for admin or instructor employees');
    }
  }

  private async nextContractNumber() {
    const year = new Date().getFullYear();
    const prefix = `UTH-CTR-${year}-`;
    const last = await this.prisma.employmentContract.findFirst({
      where: { contractNumber: { startsWith: prefix } },
      orderBy: { contractNumber: 'desc' },
      select: { contractNumber: true },
    });
    const next = last ? Number(last.contractNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(4, '0')}`;
  }

  private resolveStatus(
    current: EmploymentContractStatus,
    requested?: EmploymentContractStatus,
  ): EmploymentContractStatus {
    if (!requested || requested === current) return current;
    return requested;
  }

  private toPersistData(dto: Partial<CreateContractDto>) {
    return {
      ...(dto.employeeUserId ? { employeeUserId: dto.employeeUserId } : {}),
      ...(dto.type ? { type: dto.type } : {}),
      ...(dto.timeType ? { timeType: dto.timeType } : {}),
      ...(dto.employerName ? { employerName: dto.employerName.trim() } : {}),
      ...(dto.employerSeat ? { employerSeat: dto.employerSeat.trim() } : {}),
      ...(dto.employerRegistrationNumber
        ? { employerRegistrationNumber: dto.employerRegistrationNumber.trim() }
        : {}),
      ...(dto.employeeFirstName ? { employeeFirstName: dto.employeeFirstName.trim() } : {}),
      ...(dto.employeeLastName ? { employeeLastName: dto.employeeLastName.trim() } : {}),
      ...(dto.employeeQualification ? { employeeQualification: dto.employeeQualification.trim() } : {}),
      ...(dto.employeeResidence ? { employeeResidence: dto.employeeResidence.trim() } : {}),
      ...(dto.employeePersonalNumber !== undefined
        ? { employeePersonalNumber: dto.employeePersonalNumber?.trim() || null }
        : {}),
      ...(dto.jobTitle ? { jobTitle: dto.jobTitle.trim() } : {}),
      ...(dto.jobNature ? { jobNature: dto.jobNature.trim() } : {}),
      ...(dto.jobDescription ? { jobDescription: dto.jobDescription.trim() } : {}),
      ...(dto.workplace ? { workplace: dto.workplace.trim() } : {}),
      ...(dto.workInMultipleLocations !== undefined
        ? { workInMultipleLocations: dto.workInMultipleLocations }
        : {}),
      ...(dto.weeklyHours !== undefined ? { weeklyHours: dto.weeklyHours } : {}),
      ...(dto.workSchedule ? { workSchedule: dto.workSchedule.trim() } : {}),
      ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
      ...(dto.baseSalary !== undefined ? { baseSalary: new Prisma.Decimal(dto.baseSalary) } : {}),
      ...(dto.collaborationPercentage !== undefined
        ? { collaborationPercentage: dto.collaborationPercentage ? new Prisma.Decimal(dto.collaborationPercentage) : null }
        : {}),
      ...(dto.percentageBase !== undefined ? { percentageBase: dto.percentageBase?.trim() || null } : {}),
      ...(dto.type && dto.type !== 'COLLABORATION'
        ? { collaborationPercentage: null, percentageBase: null }
        : {}),
      ...(dto.type === 'COLLABORATION' && dto.percentageBase === undefined
        ? { percentageBase: DEFAULT_PERCENTAGE_BASE }
        : {}),
      ...(dto.allowances !== undefined ? { allowances: dto.allowances?.trim() || null } : {}),
      ...(dto.paymentDay !== undefined ? { paymentDay: dto.paymentDay ?? null } : {}),
      ...(dto.annualLeaveDays !== undefined ? { annualLeaveDays: dto.annualLeaveDays } : {}),
      ...(dto.noticePeriodDays !== undefined ? { noticePeriodDays: dto.noticePeriodDays } : {}),
      ...(dto.terminationTerms !== undefined ? { terminationTerms: dto.terminationTerms?.trim() || null } : {}),
      ...(dto.probationMonths !== undefined ? { probationMonths: dto.probationMonths } : {}),
      ...(dto.agreedTerms !== undefined ? { agreedTerms: dto.agreedTerms?.trim() || null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
    };
  }

  private withEffectiveStatus<T extends { status: EmploymentContractStatus; endDate: Date | null }>(
    contract: T,
  ): T & { status: EmploymentContractStatus } {
    if (
      (contract.status === 'ACTIVE' || contract.status === 'ISSUED') &&
      contract.endDate &&
      contract.endDate < new Date()
    ) {
      return { ...contract, status: 'EXPIRED' };
    }
    return contract;
  }

  private toListItem(contract: {
    id: string;
    contractNumber: string;
    employeeUserId: string;
    jobTitle: string;
    type: EmploymentContractType;
    status: EmploymentContractStatus;
    startDate: Date;
    endDate: Date | null;
    baseSalary: Prisma.Decimal;
    collaborationPercentage: Prisma.Decimal | null;
    employee: { firstName: string; lastName: string };
    employeeFirstName: string;
    employeeLastName: string;
  }): EmploymentContractListItem {
    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      employeeUserId: contract.employeeUserId,
      employeeName: `${contract.employeeFirstName} ${contract.employeeLastName}`.trim(),
      jobTitle: contract.jobTitle,
      type: contract.type,
      status: contract.status,
      startDate: contract.startDate.toISOString().slice(0, 10),
      endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
      baseSalary: contract.baseSalary.toFixed(2),
      collaborationPercentage: contract.collaborationPercentage?.toFixed(2) ?? null,
    };
  }

  private toDetail(contract: {
    id: string;
    contractNumber: string;
    employeeUserId: string;
    type: EmploymentContractType;
    status: EmploymentContractStatus;
    timeType: 'FULL_TIME' | 'PART_TIME';
    employerName: string;
    employerSeat: string;
    employerRegistrationNumber: string;
    employeeFirstName: string;
    employeeLastName: string;
    employeeQualification: string;
    employeeResidence: string;
    employeePersonalNumber: string | null;
    jobTitle: string;
    jobNature: string;
    jobDescription: string;
    workplace: string;
    workInMultipleLocations: boolean;
    weeklyHours: number;
    workSchedule: string;
    startDate: Date;
    endDate: Date | null;
    baseSalary: Prisma.Decimal;
    collaborationPercentage: Prisma.Decimal | null;
    percentageBase: string | null;
    allowances: string | null;
    paymentDay: number | null;
    annualLeaveDays: number;
    noticePeriodDays: number;
    terminationTerms: string | null;
    probationMonths: number;
    agreedTerms: string | null;
    notes: string | null;
    issuedAt: Date | null;
    signedAt: Date | null;
    terminatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    employee: { firstName: string; lastName: string };
  }): EmploymentContractDetail {
    return {
      ...this.toListItem(contract),
      timeType: contract.timeType,
      employerName: contract.employerName,
      employerSeat: contract.employerSeat,
      employerRegistrationNumber: contract.employerRegistrationNumber,
      employeeFirstName: contract.employeeFirstName,
      employeeLastName: contract.employeeLastName,
      employeeQualification: contract.employeeQualification,
      employeeResidence: contract.employeeResidence,
      employeePersonalNumber: contract.employeePersonalNumber,
      jobNature: contract.jobNature,
      jobDescription: contract.jobDescription,
      workplace: contract.workplace,
      workInMultipleLocations: contract.workInMultipleLocations,
      weeklyHours: contract.weeklyHours,
      workSchedule: contract.workSchedule,
      percentageBase: contract.percentageBase,
      allowances: contract.allowances,
      paymentDay: contract.paymentDay,
      annualLeaveDays: contract.annualLeaveDays,
      noticePeriodDays: contract.noticePeriodDays,
      terminationTerms: contract.terminationTerms,
      probationMonths: contract.probationMonths,
      agreedTerms: contract.agreedTerms,
      notes: contract.notes,
      issuedAt: contract.issuedAt?.toISOString() ?? null,
      signedAt: contract.signedAt?.toISOString() ?? null,
      terminatedAt: contract.terminatedAt?.toISOString() ?? null,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
    };
  }
}
