'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavSection } from '@/lib/navigation';

interface AppSidebarProps {
  sections: NavSection[];
  collapsed: boolean;
}

export function AppSidebar({ sections, collapsed }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'hidden h-full shrink-0 border-r bg-card md:flex md:flex-col',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className={cn('flex h-14 items-center border-b px-4', collapsed && 'justify-center px-2')}>
        {!collapsed ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unity Tech Hub
            </p>
            <p className="text-sm font-semibold">Management</p>
          </div>
        ) : (
          <span className="text-sm font-bold">UT</span>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {sections.map((section, index) => (
          <div key={section.label ?? `section-${index}`} className="space-y-1">
            {section.label && !collapsed ? (
              <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted',
                    active && 'bg-muted font-medium text-foreground',
                    collapsed && 'justify-center px-2',
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span>{item.title}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
