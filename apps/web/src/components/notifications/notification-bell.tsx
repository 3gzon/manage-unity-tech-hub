'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { fetchNotificationUnreadCount } from '@/lib/notifications-api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { isAdminPortalUser } from '@/lib/auth/authorization';

export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!isAdminPortalUser(user)) return;
    try {
      const response = await fetchNotificationUnreadCount();
      setUnreadCount(response.unreadCount);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!isAdminPortalUser(user)) {
    return null;
  }

  return (
    <Link href="/notifications">
      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>
    </Link>
  );
}
