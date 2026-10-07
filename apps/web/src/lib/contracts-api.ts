import type {
  EmploymentContractDetail,
  EmploymentContractInput,
  EmploymentContractListQuery,
  EmploymentContractListResponse,
  UpdateEmploymentContractRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth/token-storage';

export function fetchContracts(query: EmploymentContractListQuery = {}) {
  return api.get<EmploymentContractListResponse>('contracts', {
    params: {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      employeeUserId: query.employeeUserId,
      type: query.type,
      status: query.status,
    },
  });
}

export function fetchContract(id: string) {
  return api.get<EmploymentContractDetail>(`contracts/${id}`);
}

export function createContract(data: EmploymentContractInput) {
  return api.post<EmploymentContractDetail>('contracts', data);
}

export function updateContract(id: string, data: UpdateEmploymentContractRequest) {
  return api.patch<EmploymentContractDetail>(`contracts/${id}`, data);
}

export function archiveContract(id: string) {
  return api.delete<void>(`contracts/${id}`);
}

export async function downloadContractPdf(id: string, contractNumber: string) {
  const token = getAccessToken();
  if (!token) throw new Error('Not signed in');

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/contracts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Could not generate the contract PDF');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${contractNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
