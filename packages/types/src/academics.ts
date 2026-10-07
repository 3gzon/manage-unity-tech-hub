import type { PaginatedResponse } from './pagination';

export type CourseCategory =
  | 'KIDS_PROGRAMMING'
  | 'WEB_DEVELOPMENT'
  | 'FULL_STACK'
  | 'AI_ENGINEERING'
  | 'DATA_ENGINEERING'
  | 'DESIGN'
  | 'ENGLISH'
  | 'SUPPLEMENTARY_EDUCATION'
  | 'OTHER';

export type CourseStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type GroupStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'WITHDRAWN';

export interface CourseListItem {
  id: string;
  code: string;
  name: string;
  category: CourseCategory;
  ageMin: number | null;
  ageMax: number | null;
  durationMonths: number | null;
  defaultMonthlyPrice: string | null;
  status: CourseStatus;
  activeGroupsCount: number;
}

export interface CourseDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: CourseCategory;
  ageMin: number | null;
  ageMax: number | null;
  durationMonths: number | null;
  defaultMonthlyPrice: string | null;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GroupScheduleEntry {
  id: string;
  dayOfWeek: number;
  dayLabel: string;
  startTime: string;
  endTime: string;
}

export interface GroupListItem {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  instructorId: string | null;
  instructorName: string | null;
  capacity: number | null;
  enrolledCount: number;
  startDate: string | null;
  endDate: string | null;
  room: string | null;
  status: GroupStatus;
  scheduleSummary: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  instructorId: string | null;
  instructorName: string | null;
  capacity: number | null;
  enrolledCount: number;
  startDate: string | null;
  endDate: string | null;
  room: string | null;
  status: GroupStatus;
  schedules: GroupScheduleEntry[];
  course?: CourseDetail;
  enrollments?: EnrollmentListItem[];
  financialSummary?: GroupFinancialSummary;
}

export interface GroupFinancialSummary {
  totalMonthlyRevenue: string;
  activeEnrollments: number;
  billingEnabledCount: number;
}

export interface EnrollmentListItem {
  id: string;
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  courseName: string;
  startDate: string;
  endDate: string | null;
  status: EnrollmentStatus;
  agreedMonthlyPrice?: string;
  discountAmount?: string;
  billingEnabled?: boolean;
  notes: string | null;
}

export interface EnrollmentDetail extends EnrollmentListItem {
  discountId: string | null;
  discountName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCourseRequest {
  code?: string;
  name: string;
  description?: string;
  category: CourseCategory;
  ageMin?: number;
  ageMax?: number;
  durationMonths?: number;
  defaultMonthlyPrice?: number;
  status?: CourseStatus;
}

export type UpdateCourseRequest = Partial<CreateCourseRequest>;

export interface GroupScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sessionDate?: string;
}

export interface CreateGroupRequest {
  name: string;
  courseId: string;
  instructorId?: string | null;
  capacity?: number;
  startDate?: string;
  endDate?: string;
  room?: string;
  status?: GroupStatus;
  schedules?: GroupScheduleInput[];
}

export type UpdateGroupRequest = Partial<CreateGroupRequest>;

export interface CreateEnrollmentRequest {
  studentId: string;
  groupId: string;
  startDate: string;
  agreedMonthlyPrice: number;
  discountId?: string;
  discountAmount?: number;
  billingEnabled?: boolean;
  notes?: string;
  status?: EnrollmentStatus;
}

export type UpdateEnrollmentRequest = Partial<CreateEnrollmentRequest> & {
  endDate?: string;
  status?: EnrollmentStatus;
};

export interface CourseListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: CourseCategory;
  status?: CourseStatus;
  sortBy?: 'name' | 'category' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface GroupListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  courseId?: string;
  instructorId?: string;
  status?: GroupStatus;
  sortBy?: 'name' | 'startDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface EnrollmentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  studentId?: string;
  groupId?: string;
  courseId?: string;
  status?: EnrollmentStatus;
  sortBy?: 'startDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export type CourseListResponse = PaginatedResponse<CourseListItem>;
export type GroupListResponse = PaginatedResponse<GroupListItem>;
export type EnrollmentListResponse = PaginatedResponse<EnrollmentListItem>;

export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function formatScheduleSummary(schedules: Pick<GroupScheduleEntry, 'dayLabel' | 'startTime' | 'endTime'>[]): string {
  if (!schedules.length) return 'No schedule';
  return schedules.map((s) => `${s.dayLabel.slice(0, 3)} ${s.startTime}-${s.endTime}`).join(', ');
}
