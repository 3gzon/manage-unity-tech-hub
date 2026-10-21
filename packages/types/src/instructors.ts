import type { PaginatedResponse } from './pagination';
import type { GroupStatus } from './academics';

export interface InstructorListItem {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  hireDate: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  accountStatus: 'ACTIVE' | 'PENDING' | 'DISABLED' | null;
  activeGroupsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorAssignedGroup {
  id: string;
  name: string;
  courseName: string;
  status: GroupStatus;
  enrolledCount: number;
}

export type FeedbackRating = 'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_SUPPORT';

export interface InstructorStudent {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  email: string | null;
  groupId: string;
  groupName: string;
  courseName: string;
  status: 'ACTIVE' | 'PENDING';
}

export interface SendStudentFeedbackRequest {
  studentId: string;
  groupId: string;
  email: string;
  period: string;
  overall: FeedbackRating;
  participation: FeedbackRating;
  understanding: FeedbackRating;
  practice: FeedbackRating;
  attendance: FeedbackRating;
  strengths: string;
  improvements: string;
  nextSteps: string;
}

export interface SendStudentFeedbackResponse {
  sentTo: string;
  detail: string;
}

export interface StudentFeedbackItem {
  id: string;
  studentId: string;
  studentName: string;
  instructorId: string;
  instructorName: string;
  groupId: string;
  groupName: string;
  courseName: string;
  period: string;
  overall: FeedbackRating;
  participation: FeedbackRating;
  understanding: FeedbackRating;
  practice: FeedbackRating;
  attendance: FeedbackRating;
  strengths: string;
  improvements: string;
  nextSteps: string;
  sentTo: string;
  createdAt: string;
}

export interface StudentFeedbackListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  studentId?: string;
  instructorId?: string;
}

export type StudentFeedbackListResponse = PaginatedResponse<StudentFeedbackItem>;

export interface InstructorDetail extends InstructorListItem {
  groups: InstructorAssignedGroup[];
  students: InstructorStudent[];
}

export interface InstructorListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export type InstructorListResponse = PaginatedResponse<InstructorListItem>;

export interface CreateInstructorRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  bio?: string;
  hireDate?: string;
  userId?: string | null;
}

export type UpdateInstructorRequest = Partial<CreateInstructorRequest>;

export interface InstructorOption {
  id: string;
  name: string;
  email: string;
}

export interface InstructorLookups {
  linkableUsers: Array<{ id: string; name: string; email: string }>;
}

export type InstructorOptionsResponse = InstructorOption[];
