'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppNotification } from '@unity/types';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';

export function NotificationsPageContent() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchNotifications({ page: 1, pageSize: 50 });
      setItems(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMarkRead(id: string) {
    const updated = await markNotificationRead(id);
    setItems((current) => current.map((item) => (item.id === id ? updated : item)));
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    await load();
  }

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Attendance confirmations and other admin alerts.
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={() => void handleMarkAll()}>
            Mark all as read
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load notifications" description={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications" description="Attendance confirmations will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`w-full rounded-xl border p-4 text-left ${item.readAt ? 'bg-background' : 'bg-muted/40'}`}
              onClick={() => {
                if (!item.readAt) void handleMarkRead(item.id);
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.title}</p>
                <Badge variant="outline">{item.type}</Badge>
                {!item.readAt ? <Badge variant="secondary">Unread</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
