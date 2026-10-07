import type {
  CreateStudentRequest,
  StudentFilterOptionsResponse,
  StudentListQuery,
  StudentListResponse,
  StudentProfileResponse,
  UpdateStudentRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchStudentFilterOptions() {
  return api.get<StudentFilterOptionsResponse>('students/filter-options');
}

export function fetchStudents(query: StudentListQuery = {}) {
  return api.get<StudentListResponse>('students', { params: query });
}

export function fetchStudent(id: string) {
  return api.get<StudentProfileResponse>(`students/${id}`);
}

export function createStudent(data: CreateStudentRequest) {
  return api.post<StudentProfileResponse>('students', data);
}

export function updateStudent(id: string, data: UpdateStudentRequest) {
  return api.patch<StudentProfileResponse>(`students/${id}`, data);
}

export function archiveStudent(id: string) {
  return api.delete<void>(`students/${id}`);
}

export function addFamilyMember(studentId: string, memberId: string) {
  return api.post<StudentProfileResponse>(`students/${studentId}/family`, { studentId: memberId });
}

export function leaveFamily(studentId: string) {
  return api.delete<StudentProfileResponse>(`students/${studentId}/family`);
}
