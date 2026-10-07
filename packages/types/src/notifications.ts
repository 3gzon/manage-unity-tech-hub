import type { PaginatedResponse } from './pagination';

export type NotificationType = 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' | 'REMINDER';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export type NotificationListResponse = PaginatedResponse<AppNotification>;

export interface NotificationUnreadCount {
  unreadCount: number;
}
