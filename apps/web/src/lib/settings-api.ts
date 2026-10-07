import type { SystemSettings, UpdateSystemSettingsRequest } from '@unity/types';
import { api } from '@/lib/api-client';

export function fetchSettings() {
  return api.get<SystemSettings>('settings');
}

export function updateSettings(data: UpdateSystemSettingsRequest) {
  return api.patch<SystemSettings>('settings', data);
}
