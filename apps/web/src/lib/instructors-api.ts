import type {
  CreateInstructorRequest,
  InstructorDetail,
  InstructorListQuery,
  InstructorListResponse,
  InstructorLookups,
  InstructorOption,
  UpdateInstructorRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchInstructors(query: InstructorListQuery = {}) {
  return api.get<InstructorListResponse>('instructors', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    },
  });
}

export function fetchInstructor(id: string) {
  return api.get<InstructorDetail>(`instructors/${id}`);
}

export function fetchInstructorOptions() {
  return api.get<InstructorOption[]>('instructors/options');
}

export function fetchInstructorLookups() {
  return api.get<InstructorLookups>('instructors/lookups');
}

export function createInstructor(data: CreateInstructorRequest) {
  return api.post<InstructorDetail>('instructors', data);
}

export function updateInstructor(id: string, data: UpdateInstructorRequest) {
  return api.patch<InstructorDetail>(`instructors/${id}`, data);
}

export function archiveInstructor(id: string) {
  return api.delete<void>(`instructors/${id}`);
}
