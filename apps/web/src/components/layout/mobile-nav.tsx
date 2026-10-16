'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavSection } from '@/lib/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface MobileNavProps {
  sections: NavSection[];
}

export function MobileNav({ sections }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full md:hidden" aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-white text-[#020D23] md:hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#046bd2] text-sm font-bold text-white">
            U
          </div>
          <div>
            <p className="text-sm font-bold">Unity Tech Hub</p>
            <p className="text-xs text-slate-400">Management</p>
          </div>
        </div>
        <nav className="space-y-4 overflow-y-auto p-3">
          {sections.map((section, index) => (
            <div key={section.label ?? `mobile-section-${index}`} className="space-y-1">
              {section.label ? (
                <p className="px-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
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
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-[#020D23]',
                      active && 'bg-[#046bd2] font-medium text-white shadow-md shadow-[#046bd2]/25',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
