import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  AppNotification,
  NotificationListResponse,
  NotificationType,
  NotificationUnreadCount,
} from '@unity/types';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyAdmins(input: {
    title: string;
    message: string;
    type?: NotificationType;
    excludeUserId?: string;
  }) {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
          roles: {
            some: {
              role: { name: { in: [...ADMIN_ROLES] } },
            },
          },
        },
        select: { id: true },
      });

      if (!admins.length) {
        return { created: 0 };
      }

      await this.prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: input.type ?? 'INFO',
          title: input.title,
          message: input.message,
        })),
      });

      return { created: admins.length };
    } catch (error) {
      this.logger.error('Failed to notify admins', error instanceof Error ? error.stack : error);
      return { created: 0 };
    }
  }

  async listForUser(
    user: AuthenticatedUser,
    query: { page?: number; pageSize?: number; unreadOnly?: boolean },
  ): Promise<NotificationListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: notifications.map((notification) => this.toItem(notification)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async unreadCount(user: AuthenticatedUser): Promise<NotificationUnreadCount> {
    const unreadCount = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { unreadCount };
  }

  async markRead(user: AuthenticatedUser, id: string): Promise<AppNotification> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = notification.readAt
      ? notification
      : await this.prisma.notification.update({
          where: { id },
          data: { readAt: new Date() },
        });

    return this.toItem(updated);
  }

  async markAllRead(user: AuthenticatedUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private toItem(notification: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    readAt: Date | null;
    createdAt: Date;
  }): AppNotification {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
