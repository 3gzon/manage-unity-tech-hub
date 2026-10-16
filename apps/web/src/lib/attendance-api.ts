import type {
  ClassSessionListQuery,
  ClassSessionListResponse,
  CreateClassSessionRequest,
  GenerateSessionsRequest,
  GenerateSessionsResponse,
  GroupAttendanceResponse,
  SaveGroupAttendanceRequest,
  InstructorScheduleQuery,
  InstructorScheduleResponse,
  SessionAttendanceResponse,
  TodayClassItem,
  UpdateSessionAttendanceRequest,
} from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchTodayClasses(date?: string) {
  return api.get<TodayClassItem[]>('attendance/today', { params: { date } });
}

export function fetchInstructorSchedule(query: InstructorScheduleQuery = {}) {
  return api.get<InstructorScheduleResponse>('attendance/schedule', {
    params: { fromDate: query.fromDate, toDate: query.toDate },
  });
}

export function fetchGroupAttendance(groupId: string) {
  return api.get<GroupAttendanceResponse>(`groups/${groupId}/attendance`);
}

export function saveGroupAttendance(groupId: string, data: SaveGroupAttendanceRequest) {
  return api.put<GroupAttendanceResponse>(`groups/${groupId}/attendance`, data);
}

export function fetchGroupSessions(groupId: string, query: ClassSessionListQuery = {}) {
  return api.get<ClassSessionListResponse>(`groups/${groupId}/sessions`, { params: query });
}

export function createGroupSession(groupId: string, data: CreateClassSessionRequest) {
  return api.post(`groups/${groupId}/sessions`, data);
}

export function deleteGroupSession(groupId: string, sessionId: string) {
  return api.delete<{ deleted: boolean }>(`groups/${groupId}/sessions/${sessionId}`);
}

export function generateGroupSessions(groupId: string, data: GenerateSessionsRequest) {
  return api.post<GenerateSessionsResponse>(`groups/${groupId}/sessions`, {
    ...data,
    generateFromSchedule: true,
  });
}

export function fetchSessionAttendance(sessionId: string) {
  return api.get<SessionAttendanceResponse>(`sessions/${sessionId}/attendance`);
}

export function updateSessionAttendance(sessionId: string, data: UpdateSessionAttendanceRequest) {
  return api.put<SessionAttendanceResponse>(`sessions/${sessionId}/attendance`, data);
}
