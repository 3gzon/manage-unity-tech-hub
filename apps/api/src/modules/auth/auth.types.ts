import type { AuthTokensResponse } from '@unity/types';

export type AuthTokensWithRefresh = AuthTokensResponse & {
  refreshToken: string;
};

export type JwtDuration = `${number}${'s' | 'm' | 'h' | 'd'}`;

export function toJwtDuration(value: string | undefined, fallback: JwtDuration): JwtDuration {
  if (value && /^(\d+)([smhd])$/.test(value)) {
    return value as JwtDuration;
  }
  return fallback;
}
