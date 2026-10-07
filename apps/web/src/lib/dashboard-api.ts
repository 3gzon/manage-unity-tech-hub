import type { AdminDashboardResponse, InstructorDashboardResponse } from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchAdminDashboard() {
  return api.get<AdminDashboardResponse>('dashboard/admin');
}

export function fetchInstructorDashboard() {
  return api.get<InstructorDashboardResponse>('dashboard/instructor');
}
