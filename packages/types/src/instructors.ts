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

export interface InstructorDetail extends InstructorListItem {
  groups: InstructorAssignedGroup[];
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
