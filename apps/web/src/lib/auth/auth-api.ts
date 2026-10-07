import type { AuthTokensResponse, AuthUser, LoginRequest } from '@unity/types';

const DEFAULT_API_URL = 'http://localhost:3001/api';

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl().replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message: string | string[] }).message)
        : `Request failed with status ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function loginRequest(credentials: LoginRequest): Promise<AuthTokensResponse> {
  return authFetch<AuthTokensResponse>('auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function refreshRequest(): Promise<AuthTokensResponse> {
  return authFetch<AuthTokensResponse>('auth/refresh', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function logoutRequest(accessToken: string): Promise<void> {
  await authFetch<void>('auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function meRequest(accessToken: string): Promise<AuthUser> {
  return authFetch<AuthUser>('auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
