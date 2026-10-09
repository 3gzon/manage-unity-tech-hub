import type { PaginatedResponse } from './pagination';

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'GRADUATED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type StudentPaymentStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'NONE';

export interface GuardianInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  relationship: 'MOTHER' | 'FATHER' | 'GUARDIAN' | 'OTHER';
}

export interface GuardianDto extends GuardianInput {
  id: string;
}

export interface StudentListItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number | null;
  phone: string | null;
  email: string | null;
  status: StudentStatus;
  guardianName: string | null;
  activeCourse: string | null;
  activeGroup: string | null;
  paymentStatus: StudentPaymentStatus;
  registrationDate: string;
}

export interface StudentDetail {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: Gender | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  school: string | null;
  notes: string | null;
  instructorId: string | null;
  instructorName: string | null;
  status: StudentStatus;
  registrationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentEnrollmentSummary {
  id: string;
  groupId: string;
  groupName: string;
  courseId: string;
  courseName: string;
  status: string;
  startDate: string;
  endDate: string | null;
}

export interface StudentAttendanceSummary {
  id: string;
  sessionDate: string;
  groupName: string;
  status: string;
}

export interface StudentInvoiceSummary {
  id: string;
  invoiceNumber: string;
  total: string;
  remainingAmount: string;
  status: string;
  dueDate: string;
}

export interface StudentPaymentSummary {
  id: string;
  amount: string;
  method: string;
  paymentDate: string;
}

export interface StudentCertificateSummary {
  id: string;
  courseName: string;
  certificateCode: string;
  issuedDate: string;
}

export interface StudentFamilyMember {
  id: string;
  fullName: string;
  enrolled: boolean;
}

export interface StudentFamily {
  id: string;
  name: string;
  members: StudentFamilyMember[];
}

export interface AddFamilyMemberRequest {
  studentId: string;
}

export interface StudentProfileResponse {
  student: StudentDetail;
  guardians: GuardianDto[];
  family: StudentFamily | null;
  activeEnrollment: StudentEnrollmentSummary | null;
  enrollments: StudentEnrollmentSummary[];
  attendance: StudentAttendanceSummary[];
  invoices?: StudentInvoiceSummary[];
  payments?: StudentPaymentSummary[];
  certificates?: StudentCertificateSummary[];
}

export interface CreateStudentRequest {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  email?: string;
  address?: string;
  school?: string;
  notes?: string;
  age?: number;
  instructorId?: string;
  status?: StudentStatus;
  registrationDate?: string;
  guardians?: GuardianInput[];
}

export type UpdateStudentRequest = Partial<Omit<CreateStudentRequest, 'age' | 'instructorId'>> & {
  age?: number | null;
  instructorId?: string | null;
};

export interface StudentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: StudentStatus;
  courseId?: string;
  groupId?: string;
  paymentStatus?: StudentPaymentStatus;
  sortBy?: 'firstName' | 'lastName' | 'registrationDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export type StudentListResponse = PaginatedResponse<StudentListItem>;

export interface ImportStudentItem {
  row: number;
  student: CreateStudentRequest;
}

export interface ImportStudentsRequest {
  students: ImportStudentItem[];
}

export interface StudentImportFailure {
  row: number;
  name: string;
  message: string;
}

export interface ImportStudentsResponse {
  created: number;
  skipped: number;
  failed: StudentImportFailure[];
}

export interface StudentFilterOption {
  id: string;
  name: string;
}

export interface StudentFilterOptionsResponse {
  courses: StudentFilterOption[];
  groups: Array<StudentFilterOption & { courseId: string }>;
}
