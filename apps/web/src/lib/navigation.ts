import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Receipt,
  Settings,
  Shield,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import type { AuthUser } from '@unity/types';
import { hasAnyPermission, hasPermission, hasRole, isSuperAdmin } from '@/lib/auth/authorization';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  visible?: (user: AuthUser) => boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

const adminSections: NavSection[] = [
  {
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'People',
    items: [
      {
        title: 'Students',
        href: '/students',
        icon: GraduationCap,
        visible: (user) => hasPermission(user, 'students.read'),
      },
      {
        title: 'Instructors',
        href: '/instructors',
        icon: UserCog,
        visible: (user) => hasPermission(user, 'instructors.read'),
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        title: 'Courses',
        href: '/courses',
        icon: BookOpen,
        visible: (user) => hasPermission(user, 'courses.read'),
      },
      {
        title: 'Groups',
        href: '/groups',
        icon: Users,
        visible: (user) => hasPermission(user, 'groups.read'),
      },
      {
        title: 'Enrollments',
        href: '/enrollments',
        icon: ClipboardList,
        visible: (user) => hasPermission(user, 'enrollments.read'),
      },
      {
        title: "Today's Classes",
        href: '/attendance',
        icon: ClipboardList,
        visible: (user) => hasPermission(user, 'attendance.read'),
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        title: 'Payments',
        href: '/payments',
        icon: CreditCard,
        visible: (user) => hasPermission(user, 'payments.read'),
      },
      {
        title: 'Invoices',
        href: '/invoices',
        icon: FileText,
        visible: (user) => hasPermission(user, 'invoices.read'),
      },
      {
        title: 'Expenses',
        href: '/expenses',
        icon: Wallet,
        visible: (user) => hasPermission(user, 'expenses.read'),
      },
      {
        title: 'Instructor Compensation',
        href: '/compensation',
        icon: Receipt,
        visible: (user) => hasAnyPermission(user, 'compensation.read', 'compensation.manage'),
      },
    ],
  },
  {
    items: [
      {
        title: 'Reports',
        href: '/reports',
        icon: BarChart3,
        visible: (user) => hasPermission(user, 'reports.financial'),
      },
      {
        title: 'Certificates',
        href: '/certificates',
        icon: Award,
        visible: (user) => hasPermission(user, 'certificates.read'),
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        title: 'Users',
        href: '/users',
        icon: Shield,
        visible: (user) => hasPermission(user, 'users.read'),
      },
      {
        title: 'Contracts',
        href: '/contracts',
        icon: FileSignature,
        visible: (user) => isSuperAdmin(user),
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
        visible: (user) => hasPermission(user, 'settings.manage'),
      },
    ],
  },
];

const instructorSections: NavSection[] = [
  {
    items: [{ title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    items: [
      {
        title: 'My Groups',
        href: '/my-groups',
        icon: Users,
        visible: (user) => hasPermission(user, 'groups.read'),
      },
      {
        title: 'My Schedule',
        href: '/my-schedule',
        icon: CalendarDays,
        visible: (user) => hasPermission(user, 'groups.read'),
      },
      {
        title: "Today's Classes",
        href: '/attendance',
        icon: ClipboardList,
        visible: (user) => hasPermission(user, 'attendance.read'),
      },
      {
        title: 'Students',
        href: '/students',
        icon: GraduationCap,
        visible: (user) => hasPermission(user, 'students.read'),
      },
    ],
  },
];

export function getNavigationSections(user: AuthUser | null): NavSection[] {
  if (!user) {
    return [];
  }

  const isAdminUser = hasRole(user, 'SUPER_ADMIN', 'ADMIN');
  const sections = isAdminUser ? adminSections : instructorSections;

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (item.visible ? item.visible(user) : true)),
    }))
    .filter((section) => section.items.length > 0);
}

export function isAdminPortalUser(user: AuthUser | null): boolean {
  return Boolean(user && hasRole(user, 'SUPER_ADMIN', 'ADMIN'));
}
