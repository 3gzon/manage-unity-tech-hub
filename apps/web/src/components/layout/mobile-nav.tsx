'use client';

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

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="md:hidden">
        <div className="border-b px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Unity Tech Hub
          </p>
          <p className="text-sm font-semibold">Management</p>
        </div>
        <nav className="space-y-4 overflow-y-auto p-4">
          {sections.map((section, index) => (
            <div key={section.label ?? `mobile-section-${index}`} className="space-y-1">
              {section.label ? (
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
                      'flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted',
                      active && 'bg-muted font-medium',
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
