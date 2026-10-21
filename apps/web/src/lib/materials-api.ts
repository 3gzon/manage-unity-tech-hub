import type {
  CreateMaterialCommentRequest,
  CreateMaterialRequest,
  MaterialDecisionRequest,
  MaterialDetail,
  MaterialListQuery,
  MaterialListResponse,
  MaterialTopicOption,
  UpdateMaterialRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchMaterials(query: MaterialListQuery = {}) {
  return api.get<MaterialListResponse>('materials', { params: query });
}

export function fetchMaterialTopics(courseId: string) {
  return api.get<MaterialTopicOption[]>('materials/topics', { params: { courseId } });
}

export function fetchMaterial(id: string) {
  return api.get<MaterialDetail>(`materials/${id}`);
}

export function createMaterial(data: CreateMaterialRequest) {
  return api.post<MaterialDetail>('materials', data);
}

export function updateMaterial(id: string, data: UpdateMaterialRequest) {
  return api.patch<MaterialDetail>(`materials/${id}`, data);
}

export function decideMaterial(id: string, data: MaterialDecisionRequest) {
  return api.post<MaterialDetail>(`materials/${id}/decision`, data);
}

export function commentOnMaterial(id: string, data: CreateMaterialCommentRequest) {
  return api.post<MaterialDetail>(`materials/${id}/comments`, data);
}

export function deleteMaterial(id: string) {
  return api.delete<void>(`materials/${id}`);
}
