'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { useAuth } from '@/lib/auth/auth-context';
import { setStoredBranchId } from '@/lib/auth/branch-storage';
import { getNavigationSections, type NavItem } from '@/lib/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const sections = getNavigationSections(user);
  const pages = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const title = pageTitle(pathname, pages);
  const matches = query.trim()
    ? pages.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  function openPage(href: string) {
    setQuery('');
    setSearchOpen(false);
    router.push(href);
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-3 md:p-4">
        <div className="flex items-start gap-4">
          <AppSidebar sections={sections} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <header className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <MobileNav sections={sections} />
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">{title}</h1>
                  <p className="text-xs text-muted-foreground">{user?.branch?.name ?? 'Unity Tech Hub'}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative hidden min-w-[200px] md:block lg:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                    placeholder="Search pages…"
                    className="h-9 w-full rounded-lg border border-input bg-muted pl-9 pr-3 text-sm outline-none transition focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/15"
                  />
                  {searchOpen && query.trim() ? (
                    <div className="absolute right-0 top-11 z-30 w-full overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                      {matches.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">No matching page</p>
                      ) : (
                        matches.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.href}
                              type="button"
                              onMouseDown={() => openPage(item.href)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                            >
                              <Icon className="h-4 w-4 text-primary" />
                              {item.title}
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
                {user && user.branches.length > 1 ? (
                  <label className="hidden items-center gap-2 sm:flex">
                    <span className="text-xs font-medium text-muted-foreground">Branch</span>
                    <select
                      aria-label="Branch"
                      value={user.branch?.id ?? ''}
                      onChange={(event) => {
                        setStoredBranchId(event.target.value);
                        window.location.reload();
                      }}
                      className="h-9 rounded-lg border border-input bg-muted px-3 text-sm font-medium text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    >
                      {user.branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <NotificationBell />
                <ProfileMenu />
              </div>
            </header>
            <main className="min-w-0 flex-1 pb-6">{children}</main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function pageTitle(pathname: string, pages: NavItem[]) {
  const match = pages.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.title ?? 'Unity Tech Hub';
}
