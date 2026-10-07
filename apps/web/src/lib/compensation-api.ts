import type {
  AdjustCompensationRequest,
  CalculateCompensationRequest,
  CompensationListQuery,
  CompensationListResponse,
  CompensationLookups,
  CompensationPreview,
  CompensationRecord,
  CompensationRule,
  CompensationRuleListResponse,
  CreateCompensationRuleRequest,
  UpdateCompensationRuleRequest,
  UpdateCompensationStatusRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchCompensationLookups() {
  return api.get<CompensationLookups>('compensation/lookups');
}

export function fetchCompensationRules(query: CompensationListQuery = {}) {
  return api.get<CompensationRuleListResponse>('compensation/rules', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      instructorId: query.instructorId,
      period: query.period,
      status: query.status,
    },
  });
}

export function createCompensationRule(data: CreateCompensationRuleRequest) {
  return api.post<CompensationRule>('compensation/rules', data);
}

export function updateCompensationRule(id: string, data: UpdateCompensationRuleRequest) {
  return api.patch<CompensationRule>(`compensation/rules/${id}`, data);
}

export function archiveCompensationRule(id: string) {
  return api.delete<void>(`compensation/rules/${id}`);
}

export function calculateCompensation(data: CalculateCompensationRequest) {
  return api.post<CompensationPreview>('compensation/calculate', data);
}

export function saveCompensationSnapshot(data: CalculateCompensationRequest) {
  return api.post<CompensationPreview>('compensation/snapshots', data);
}

export function fetchCompensationRecords(query: CompensationListQuery = {}) {
  return api.get<CompensationListResponse>('compensation', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      instructorId: query.instructorId,
      period: query.period,
      status: query.status,
    },
  });
}

export function fetchCompensationRecord(id: string) {
  return api.get<CompensationRecord>(`compensation/${id}`);
}

export function adjustCompensation(id: string, data: AdjustCompensationRequest) {
  return api.post<CompensationRecord>(`compensation/${id}/adjust`, data);
}

export function updateCompensationStatus(id: string, data: UpdateCompensationStatusRequest) {
  return api.patch<CompensationRecord>(`compensation/${id}/status`, data);
}
