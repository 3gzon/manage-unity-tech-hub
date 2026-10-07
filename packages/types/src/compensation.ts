import type { PaginatedResponse } from './pagination';

export type CompensationType = 'FIXED' | 'PERCENTAGE' | 'PER_STUDENT' | 'HOURLY';
export type CompensationStatus = 'DRAFT' | 'APPROVED' | 'PAID';

export interface CompensationRule {
  id: string;
  instructorId: string;
  instructorName: string;
  courseId: string | null;
  courseName: string | null;
  groupId: string | null;
  groupName: string | null;
  type: CompensationType;
  percentage: string | null;
  fixedAmount: string | null;
  amountPerStudent: string | null;
  hourlyRate: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface CreateCompensationRuleRequest {
  instructorId: string;
  courseId?: string;
  groupId?: string;
  type: CompensationType;
  percentage?: number;
  fixedAmount?: number;
  amountPerStudent?: number;
  hourlyRate?: number;
  effectiveFrom: string;
  effectiveUntil?: string;
}

export type UpdateCompensationRuleRequest = Partial<CreateCompensationRuleRequest>;

export interface CompensationLookupOption {
  id: string;
  name: string;
}

export interface CompensationLookups {
  instructors: CompensationLookupOption[];
  courses: CompensationLookupOption[];
  groups: Array<CompensationLookupOption & { courseId: string; instructorId: string | null }>;
}

export interface CompensationCalculationLine {
  groupId: string;
  groupName: string;
  courseId: string;
  courseName: string;
  studentCount: number;
  hoursTaught: string;
  grossRevenue: string;
  ruleType: CompensationType | null;
  ruleLabel: string;
  percentage: string | null;
  fixedAmount: string | null;
  amountPerStudent: string | null;
  hourlyRate: string | null;
  calculatedAmount: string;
  adjustments: string;
  adjustmentReason: string | null;
  finalAmount: string;
  existingCompensationId: string | null;
  existingStatus: CompensationStatus | null;
  locked: boolean;
}

export interface CompensationPreview {
  instructorId: string;
  instructorName: string;
  period: string;
  lines: CompensationCalculationLine[];
  totalGrossRevenue: string;
  totalCalculated: string;
  totalAdjustments: string;
  totalFinal: string;
}

export interface CompensationRecord {
  id: string;
  instructorId: string;
  instructorName: string;
  groupId: string;
  groupName: string;
  courseName: string;
  period: string;
  studentCount: number;
  hoursTaught: string;
  grossRevenue: string;
  calculationType: CompensationType;
  percentage: string | null;
  fixedAmount: string | null;
  amountPerStudent: string | null;
  hourlyRate: string | null;
  calculatedAmount: string;
  adjustments: string;
  adjustmentReason: string | null;
  finalAmount: string;
  status: CompensationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CompensationListQuery {
  page?: number;
  pageSize?: number;
  instructorId?: string;
  period?: string;
  status?: CompensationStatus;
}

export interface CalculateCompensationRequest {
  instructorId: string;
  period: string;
}

export interface SaveCompensationRequest {
  instructorId: string;
  period: string;
}

export interface AdjustCompensationRequest {
  adjustments: number;
  adjustmentReason: string;
}

export interface UpdateCompensationStatusRequest {
  status: CompensationStatus;
}

export type CompensationListResponse = PaginatedResponse<CompensationRecord>;
export type CompensationRuleListResponse = PaginatedResponse<CompensationRule>;
