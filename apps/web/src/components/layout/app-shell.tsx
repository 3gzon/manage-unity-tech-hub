'use client';

import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppBreadcrumbs } from '@/components/layout/app-breadcrumbs';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { getNavigationSections } from '@/lib/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const sections = getNavigationSections(user);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background">
        <AppSidebar sections={sections} collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <MobileNav sections={sections} />
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setCollapsed((value) => !value)}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
              <AppBreadcrumbs />
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ProfileMenu />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
