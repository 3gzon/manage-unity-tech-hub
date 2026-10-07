'use client';

import { AdminDashboardView } from '@/components/dashboard/admin-dashboard-view';
import { InstructorDashboardView } from '@/components/dashboard/instructor-dashboard-view';
import { useAuth } from '@/lib/auth/auth-context';
import { isAdminPortalUser } from '@/lib/navigation';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return isAdminPortalUser(user) ? <AdminDashboardView /> : <InstructorDashboardView />;
}
