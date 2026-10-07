import type { GroupStatus } from './academics';
import type { PaginatedResponse } from './pagination';

export type ClassSessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface ClassSessionListItem {
  id: string;
  groupId: string;
  groupName: string;
  courseName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: ClassSessionStatus;
  attendanceSubmitted: boolean;
  enrolledCount: number;
  markedCount: number;
}

export interface ClassSessionDetail {
  id: string;
  groupId: string;
  groupName: string;
  courseName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: ClassSessionStatus;
  notes: string | null;
  attendanceSubmittedAt: string | null;
}

export interface StudentAttendanceRecord {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  notes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  whatsappUrl: string | null;
  statistics: StudentAttendanceStatistics;
}

export interface StudentAttendanceStatistics {
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
}

export interface SessionAttendanceResponse {
  session: ClassSessionDetail;
  records: StudentAttendanceRecord[];
}

export interface TodayClassItem {
  sessionId: string;
  groupId: string;
  groupName: string;
  courseName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: ClassSessionStatus;
  enrolledCount: number;
  markedCount: number;
  attendanceSubmitted: boolean;
}

export interface CreateClassSessionRequest {
  sessionDate: string;
  startTime: string;
  endTime: string;
  status?: ClassSessionStatus;
  notes?: string;
}

export interface GenerateSessionsRequest {
  fromDate: string;
  toDate: string;
}

export interface GenerateSessionsResponse {
  created: number;
  skipped: number;
}

export interface UpdateSessionAttendanceRequest {
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
  markAllPresent?: boolean;
  completeSession?: boolean;
}

export interface ClassSessionListQuery {
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
  status?: ClassSessionStatus;
}

export type ClassSessionListResponse = PaginatedResponse<ClassSessionListItem>;

export type ClassPresence = 'IN_CLASS' | 'NOT_IN_CLASS' | 'NOT_MARKED';

export interface GroupAttendanceSession {
  sessionId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  submitted: boolean;
}

export interface GroupStudentAttendanceRecord {
  sessionId: string;
  sessionDate: string;
  startTime: string;
  status: AttendanceStatus | null;
  inClass: boolean | null;
}

export interface GroupStudentAttendanceRow {
  studentId: string;
  studentName: string;
  classesAttended: number;
  classesHeld: number;
  records: GroupStudentAttendanceRecord[];
}

export interface GroupAttendanceResponse {
  sessions: GroupAttendanceSession[];
  students: GroupStudentAttendanceRow[];
}

export interface ScheduleSessionItem {
  sessionId: string;
  groupId: string;
  groupName: string;
  courseName: string;
  room: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: ClassSessionStatus;
  enrolledCount: number;
  markedCount: number;
  attendanceSubmitted: boolean;
}

export interface WeeklyScheduleSlot {
  groupId: string;
  groupName: string;
  courseName: string;
  room: string | null;
  dayOfWeek: number;
  dayLabel: string;
  startTime: string;
  endTime: string;
}

export interface InstructorScheduleQuery {
  fromDate?: string;
  toDate?: string;
}

export interface ScheduleGroupItem {
  groupId: string;
  groupName: string;
  courseName: string;
  room: string | null;
  status: GroupStatus;
  enrolledCount: number;
  scheduleSummary: string;
}

export interface InstructorScheduleResponse {
  fromDate: string;
  toDate: string;
  sessions: ScheduleSessionItem[];
  weekly: WeeklyScheduleSlot[];
  groups: ScheduleGroupItem[];
}
