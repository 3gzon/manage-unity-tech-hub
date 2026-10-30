import type {
  CreateInstructorRequest,
  InstructorDetail,
  InstructorListQuery,
  InstructorListResponse,
  InstructorLookups,
  InstructorOption,
  SendStudentFeedbackRequest,
  SendStudentFeedbackResponse,
  StudentFeedbackListQuery,
  StudentFeedbackListResponse,
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

export function fetchMyInstructor() {
  return api.get<InstructorDetail>('instructors/me');
}

export function sendStudentFeedback(instructorId: string, data: SendStudentFeedbackRequest) {
  return api.post<SendStudentFeedbackResponse>(`instructors/${instructorId}/feedback`, data);
}

export function fetchFeedback(query: StudentFeedbackListQuery = {}) {
  return api.get<StudentFeedbackListResponse>('feedback', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      studentId: query.studentId,
      instructorId: query.instructorId,
    },
  });
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

export function resendFeedbackEmail(feedbackId: string, email: string) {
  return api.post<{ sentTo: string; detail: string }>(`feedback/${feedbackId}/email`, { email });
}
