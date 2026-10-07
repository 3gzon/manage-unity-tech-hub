import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma/prisma.service';
import { getAuditContext } from './audit-context';

export interface AuditLogInput {
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput) {
    const context = getAuditContext();

    await this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? context?.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        ipAddress: input.ipAddress ?? context?.ipAddress,
        userAgent: input.userAgent ?? context?.userAgent,
      },
    });
  }
}
