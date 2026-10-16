'use client';

import { Suspense } from 'react';
import { InstructorAttendanceContent } from '@/components/attendance/instructor-attendance-content';
import { TodaysClassesContent } from '@/components/attendance/todays-classes-content';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth/auth-context';
import { isAdminPortalUser } from '@/lib/auth/authorization';

export default function AttendancePage() {
  const { user } = useAuth();
  if (user && !isAdminPortalUser(user)) {
    return (
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <InstructorAttendanceContent />
      </Suspense>
    );
  }
  return <TodaysClassesContent />;
}
