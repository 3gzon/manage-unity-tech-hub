import { Injectable } from '@nestjs/common';
import type { SystemSettings } from '@unity/types';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { UpdateSettingsDto } from './dto/settings.dto';

export const SYSTEM_SETTINGS_ID = '00000000-0000-4000-8000-000000000001';

const DEFAULTS = {
  schoolName: 'Unity Tech Hub',
  currency: 'EUR',
  multiCourseDiscountPercent: new Prisma.Decimal(10),
  familyPackDiscountPercent: new Prisma.Decimal(10),
  invoiceDueDay: 10,
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const existing = await this.prisma.systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
    if (existing) return existing;
    return this.prisma.systemSettings.create({
      data: { id: SYSTEM_SETTINGS_ID, ...DEFAULTS },
    });
  }

  async getPublic(): Promise<SystemSettings> {
    return this.toDto(await this.get());
  }

  async update(user: AuthenticatedUser, dto: UpdateSettingsDto): Promise<SystemSettings> {
    const current = await this.get();
    const updated = await this.prisma.systemSettings.update({
      where: { id: SYSTEM_SETTINGS_ID },
      data: {
        schoolName: dto.schoolName.trim(),
        currency: dto.currency.trim().toUpperCase(),
        email: blankToNull(dto.email),
        phone: blankToNull(dto.phone),
        address: blankToNull(dto.address),
        multiCourseDiscountPercent: new Prisma.Decimal(dto.multiCourseDiscountPercent),
        familyPackDiscountPercent: new Prisma.Decimal(dto.familyPackDiscountPercent),
        invoiceDueDay: dto.invoiceDueDay,
      },
    });

    await this.audit.record({
      userId: user.id,
      action: 'SETTINGS_UPDATED',
      entity: 'SystemSettings',
      entityId: SYSTEM_SETTINGS_ID,
      oldValue: {
        schoolName: current.schoolName,
        currency: current.currency,
        multiCourseDiscountPercent: current.multiCourseDiscountPercent.toFixed(2),
        familyPackDiscountPercent: current.familyPackDiscountPercent.toFixed(2),
        invoiceDueDay: current.invoiceDueDay,
      },
      newValue: {
        schoolName: updated.schoolName,
        currency: updated.currency,
        multiCourseDiscountPercent: updated.multiCourseDiscountPercent.toFixed(2),
        familyPackDiscountPercent: updated.familyPackDiscountPercent.toFixed(2),
        invoiceDueDay: updated.invoiceDueDay,
      },
    });

    return this.toDto(updated);
  }

  private toDto(settings: {
    schoolName: string;
    currency: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    multiCourseDiscountPercent: Prisma.Decimal;
    familyPackDiscountPercent: Prisma.Decimal;
    invoiceDueDay: number;
    updatedAt: Date;
  }): SystemSettings {
    return {
      schoolName: settings.schoolName,
      currency: settings.currency,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      multiCourseDiscountPercent: settings.multiCourseDiscountPercent.toFixed(2),
      familyPackDiscountPercent: settings.familyPackDiscountPercent.toFixed(2),
      invoiceDueDay: settings.invoiceDueDay,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }
}

function blankToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
