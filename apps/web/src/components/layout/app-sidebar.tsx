'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavSection } from '@/lib/navigation';

interface AppSidebarProps {
  sections: NavSection[];
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ sections, collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 flex-col rounded-3xl bg-white p-3 shadow-[0_10px_30px_rgb(15_23_42/0.06)] md:flex',
        collapsed ? 'w-[84px]' : 'w-64',
      )}
    >
      <div className={cn('flex items-center gap-3 px-2 py-3', collapsed && 'justify-center px-0')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#046bd2] text-sm font-bold text-white shadow-md shadow-[#046bd2]/30">
          U
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#020D23]">Unity Tech Hub</p>
            <p className="text-xs text-slate-400">Management</p>
          </div>
        ) : null}
      </div>

      <nav className="mt-2 flex-1 space-y-4 overflow-y-auto px-1">
        {sections.map((section, index) => (
          <div key={section.label ?? `section-${index}`} className="space-y-1">
            {section.label && !collapsed ? (
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
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
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-[#020D23]',
                    active && 'bg-[#046bd2] font-medium text-white shadow-md shadow-[#046bd2]/25 hover:bg-[#046bd2] hover:text-white',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.title}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className="mt-2 flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!collapsed ? <span>Collapse</span> : null}
      </button>
    </aside>
  );
}
