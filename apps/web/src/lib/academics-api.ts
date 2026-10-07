import type {
  CourseDetail,
  CourseListQuery,
  CourseListResponse,
  CreateCourseRequest,
  CreateEnrollmentRequest,
  CreateGroupRequest,
  EnrollmentDetail,
  EnrollmentListQuery,
  EnrollmentListResponse,
  GroupDetail,
  GroupListQuery,
  GroupListResponse,
  GroupScheduleInput,
  UpdateCourseRequest,
  UpdateEnrollmentRequest,
  UpdateGroupRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchCourses(query: CourseListQuery = {}) {
  return api.get<CourseListResponse>('courses', { params: query });
}

export function fetchCourse(id: string) {
  return api.get<CourseDetail>(`courses/${id}`);
}

export function createCourse(data: CreateCourseRequest) {
  return api.post<CourseDetail>('courses', data);
}

export function updateCourse(id: string, data: UpdateCourseRequest) {
  return api.patch<CourseDetail>(`courses/${id}`, data);
}

export function archiveCourse(id: string) {
  return api.delete<void>(`courses/${id}`);
}

export function fetchGroups(query: GroupListQuery = {}) {
  return api.get<GroupListResponse>('groups', { params: query });
}

export function fetchGroup(id: string) {
  return api.get<GroupDetail>(`groups/${id}`);
}

export function createGroup(data: CreateGroupRequest) {
  return api.post<GroupDetail>('groups', data);
}

export function updateGroup(id: string, data: UpdateGroupRequest) {
  return api.patch<GroupDetail>(`groups/${id}`, data);
}

export function updateGroupSchedule(
  id: string,
  data: { room?: string; schedules: GroupScheduleInput[] },
) {
  return api.patch<GroupDetail>(`groups/${id}/schedule`, data);
}

export function archiveGroup(id: string) {
  return api.delete<void>(`groups/${id}`);
}

export function fetchEnrollments(query: EnrollmentListQuery = {}) {
  return api.get<EnrollmentListResponse>('enrollments', { params: query });
}

export function fetchEnrollment(id: string) {
  return api.get<EnrollmentDetail>(`enrollments/${id}`);
}

export function createEnrollment(data: CreateEnrollmentRequest) {
  return api.post<EnrollmentDetail>('enrollments', data);
}

export function updateEnrollment(id: string, data: UpdateEnrollmentRequest) {
  return api.patch<EnrollmentDetail>(`enrollments/${id}`, data);
}

export function withdrawEnrollment(id: string) {
  return api.delete<void>(`enrollments/${id}`);
}
