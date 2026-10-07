import type { PaginatedResponse } from './pagination';

export const EMPLOYMENT_CONTRACT_TYPES = ['INDEFINITE', 'FIXED_TERM', 'SPECIFIC_TASK', 'COLLABORATION'] as const;
export type EmploymentContractType = (typeof EMPLOYMENT_CONTRACT_TYPES)[number];

export const EMPLOYMENT_CONTRACT_STATUSES = ['DRAFT', 'ISSUED', 'ACTIVE', 'EXPIRED', 'TERMINATED'] as const;
export type EmploymentContractStatus = (typeof EMPLOYMENT_CONTRACT_STATUSES)[number];

export const EMPLOYMENT_TIME_TYPES = ['FULL_TIME', 'PART_TIME'] as const;
export type EmploymentTimeType = (typeof EMPLOYMENT_TIME_TYPES)[number];

export interface EmploymentContractListItem {
  id: string;
  contractNumber: string;
  employeeUserId: string;
  employeeName: string;
  jobTitle: string;
  type: EmploymentContractType;
  status: EmploymentContractStatus;
  startDate: string;
  endDate: string | null;
  baseSalary: string;
  collaborationPercentage: string | null;
}

export interface EmploymentContractDetail {
  id: string;
  contractNumber: string;
  employeeUserId: string;
  employeeName: string;
  type: EmploymentContractType;
  status: EmploymentContractStatus;
  timeType: EmploymentTimeType;
  employerName: string;
  employerSeat: string;
  employerRegistrationNumber: string;
  employeeFirstName: string;
  employeeLastName: string;
  employeeQualification: string;
  employeeResidence: string;
  employeePersonalNumber: string | null;
  jobTitle: string;
  jobNature: string;
  jobDescription: string;
  workplace: string;
  workInMultipleLocations: boolean;
  weeklyHours: number;
  workSchedule: string;
  startDate: string;
  endDate: string | null;
  baseSalary: string;
  collaborationPercentage: string | null;
  percentageBase: string | null;
  allowances: string | null;
  paymentDay: number | null;
  annualLeaveDays: number;
  noticePeriodDays: number;
  terminationTerms: string | null;
  probationMonths: number;
  agreedTerms: string | null;
  notes: string | null;
  issuedAt: string | null;
  signedAt: string | null;
  terminatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentContractInput {
  employeeUserId: string;
  type: EmploymentContractType;
  timeType: EmploymentTimeType;
  employerName: string;
  employerSeat: string;
  employerRegistrationNumber: string;
  employeeFirstName: string;
  employeeLastName: string;
  employeeQualification: string;
  employeeResidence: string;
  employeePersonalNumber?: string;
  jobTitle: string;
  jobNature: string;
  jobDescription: string;
  workplace: string;
  workInMultipleLocations?: boolean;
  weeklyHours: number;
  workSchedule: string;
  startDate: string;
  endDate?: string;
  baseSalary: number;
  collaborationPercentage?: number;
  percentageBase?: string;
  allowances?: string;
  paymentDay?: number;
  annualLeaveDays: number;
  noticePeriodDays: number;
  terminationTerms?: string;
  probationMonths?: number;
  agreedTerms?: string;
  notes?: string;
}

export type UpdateEmploymentContractRequest = Partial<EmploymentContractInput> & {
  status?: EmploymentContractStatus;
};

export interface EmploymentContractListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  employeeUserId?: string;
  type?: EmploymentContractType;
  status?: EmploymentContractStatus;
}

export type EmploymentContractListResponse = PaginatedResponse<EmploymentContractListItem>;
