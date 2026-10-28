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
        'sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 flex-col rounded-2xl bg-[#020D23] p-3 md:flex',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
    >
      <div className={cn('flex items-center gap-3 px-2 py-3', collapsed && 'justify-center px-0')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#03FE94] text-sm font-bold text-[#020D23]">
          U
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Unity Tech Hub</p>
            <p className="text-[11px] text-white/40">Management</p>
          </div>
        ) : null}
      </div>

      <nav className="mt-3 flex-1 space-y-5 overflow-y-auto px-1">
        {sections.map((section, index) => (
          <div key={section.label ?? `section-${index}`} className="space-y-0.5">
            {section.label && !collapsed ? (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
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
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/40 transition-all duration-150 hover:bg-white/5 hover:text-white/80',
                    active && 'bg-[#03FE94]/10 font-medium text-[#03FE94] hover:bg-[#03FE94]/15 hover:text-[#03FE94]',
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
        className="mt-2 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-white/25 transition hover:bg-white/5 hover:text-white/50"
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!collapsed ? <span>Collapse</span> : null}
      </button>
    </aside>
  );
}
