'use client';

import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  notifications: 'Notifications',
  students: 'Students',
  instructors: 'Instructors',
  courses: 'Courses',
  groups: 'Groups',
  attendance: 'Attendance',
  payments: 'Payments',
  invoices: 'Invoices',
  expenses: 'Expenses',
  compensation: 'Instructor Compensation',
  reports: 'Reports',
  certificates: 'Certificates',
  users: 'Users',
  contracts: 'Contracts',
  new: 'New',
  settings: 'Settings',
  'my-groups': 'My Groups',
  'my-schedule': 'My Schedule',
};

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    return {
      href,
      label: LABELS[segment] ?? segment,
      isLast: index === segments.length - 1,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((crumb) => (
        <div key={crumb.href} className="flex items-center gap-1">
          {crumb.href !== crumbs[0]?.href ? <ChevronRight className="h-3.5 w-3.5" /> : null}
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
