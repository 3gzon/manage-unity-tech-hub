'use client';

import type { AuthUser, LoginRequest } from '@unity/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { loginRequest, logoutRequest, meRequest, refreshRequest } from './auth-api';
import { clearAccessToken, getAccessToken, setAccessToken } from './token-storage';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }

    const profile = await meRequest(token);
    setUser(profile);
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const token = getAccessToken();
        if (token) {
          await refreshUser();
        } else {
          const refreshed = await refreshRequest();
          setAccessToken(refreshed.accessToken);
          setUser(refreshed.user);
        }
      } catch {
        clearAccessToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, [refreshUser]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const response = await loginRequest(credentials);
      setAccessToken(response.accessToken);
      setUser(response.user);
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    const token = getAccessToken();
    try {
      if (token) {
        await logoutRequest(token);
      }
    } finally {
      clearAccessToken();
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
