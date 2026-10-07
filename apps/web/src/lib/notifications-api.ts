import type { AppNotification, NotificationListQuery, NotificationListResponse, NotificationUnreadCount } from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchNotifications(query: NotificationListQuery = {}) {
  return api.get<NotificationListResponse>('notifications', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      unreadOnly: query.unreadOnly,
    },
  });
}

export function fetchNotificationUnreadCount() {
  return api.get<NotificationUnreadCount>('notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return api.patch<AppNotification>(`notifications/${id}/read`);
}

export function markAllNotificationsRead() {
  return api.patch<{ updated: number }>('notifications/read-all');
}
