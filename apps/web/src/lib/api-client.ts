import type { ApiErrorResponse, AuthTokensResponse } from '@unity/types';
import { refreshRequest } from './auth/auth-api';
import { clearAccessToken, getAccessToken, setAccessToken } from './auth/token-storage';

const DEFAULT_API_URL = 'http://localhost:3001/api';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ApiErrorResponse,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: object;
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

function buildUrl(path: string, params?: ApiClientOptions['params']) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, `${getBaseUrl().replace(/\/$/, '')}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const apiMessage =
      typeof payload === 'object' && payload && 'message' in payload
        ? (payload as ApiErrorResponse).message
        : undefined;
    const message = Array.isArray(apiMessage)
      ? apiMessage.join(', ')
      : apiMessage
        ? String(apiMessage)
        : `Request failed with status ${response.status}`;

    throw new ApiClientError(message, response.status, isJson ? (payload as ApiErrorResponse) : undefined);
  }

  return payload as T;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response: AuthTokensResponse = await refreshRequest();
    setAccessToken(response.accessToken);
    return response.accessToken;
  } catch {
    clearAccessToken();
    return null;
  }
}

export async function apiClient<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const { body, params, headers, skipAuth, skipRefresh, ...rest } = options;

  const authHeaders: Record<string, string> = {};
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      authHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const execute = () =>
    fetch(buildUrl(path, params), {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });

  let response = await execute();

  if (response.status === 401 && !skipAuth && !skipRefresh && !path.includes('auth/refresh')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetch(buildUrl(path, params), {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
    }
  }

  return parseResponse<T>(response);
}

export const api = {
  get: <T>(path: string, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(path, { ...options, method: 'DELETE' }),
};
