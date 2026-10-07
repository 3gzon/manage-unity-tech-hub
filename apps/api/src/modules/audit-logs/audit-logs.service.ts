import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuditLogItem, AuditLogListResponse, AuditLogLookups } from '@unity/types';
import { AUDIT_ACTIONS } from '@unity/types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { ListAuditLogsQueryDto } from './dto/audit-log.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListAuditLogsQueryDto): Promise<AuditLogListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.AuditLogWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
            },
          }
        : {}),
    };

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
    ]);

    return {
      data: logs.map((log) => this.toItem(log)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<AuditLogItem> {
    const log = await this.prisma.auditLog.findFirst({
      where: { id },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!log) throw new NotFoundException('Audit log not found');
    return this.toItem(log);
  }

  async lookups(): Promise<AuditLogLookups> {
    const [users, actionRows, entityRows] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      this.prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        distinct: ['entity'],
        select: { entity: true },
        orderBy: { entity: 'asc' },
      }),
    ]);

    const actions = [...new Set([...AUDIT_ACTIONS, ...actionRows.map((row) => row.action)])].sort();
    const entities = entityRows.map((row) => row.entity);

    return {
      users: users.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      })),
      actions,
      entities,
    };
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private toItem(log: {
    id: string;
    userId: string | null;
    action: string;
    entity: string;
    entityId: string;
    oldValue: Prisma.JsonValue;
    newValue: Prisma.JsonValue;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    user: { firstName: string; lastName: string; email: string } | null;
  }): AuditLogItem {
    return {
      id: log.id,
      userId: log.userId,
      userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
      userEmail: log.user?.email ?? null,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    };
  }
}
