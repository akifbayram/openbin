import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiFetch } from './api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  activeHomeId: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  setActiveHomeId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('qrbin-token'),
    activeHomeId: localStorage.getItem('qrbin-active-home'),
    loading: true,
  });

  // Validate token on mount
  useEffect(() => {
    const token = localStorage.getItem('qrbin-token');
    if (!token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    apiFetch<User>('/api/auth/me')
      .then((user) => {
        setState((s) => ({ ...s, user, token, loading: false }));
      })
      .catch(() => {
        localStorage.removeItem('qrbin-token');
        setState((s) => ({ ...s, user: null, token: null, loading: false }));
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User; activeHomeId?: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    localStorage.setItem('qrbin-token', data.token);
    if (data.activeHomeId) {
      localStorage.setItem('qrbin-active-home', data.activeHomeId);
    }
    setState((s) => ({
      ...s,
      user: data.user,
      token: data.token,
      activeHomeId: data.activeHomeId ?? s.activeHomeId,
    }));
  }, []);

  const register = useCallback(async (username: string, password: string, displayName: string) => {
    const data = await apiFetch<{ token: string; user: User; activeHomeId?: string }>('/api/auth/register', {
      method: 'POST',
      body: { username, password, displayName },
    });
    localStorage.setItem('qrbin-token', data.token);
    if (data.activeHomeId) {
      localStorage.setItem('qrbin-active-home', data.activeHomeId);
    }
    setState((s) => ({
      ...s,
      user: data.user,
      token: data.token,
      activeHomeId: data.activeHomeId ?? s.activeHomeId,
    }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('qrbin-token');
    localStorage.removeItem('qrbin-active-home');
    setState({ user: null, token: null, activeHomeId: null, loading: false });
  }, []);

  const setActiveHomeId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('qrbin-active-home', id);
    } else {
      localStorage.removeItem('qrbin-active-home');
    }
    setState((s) => ({ ...s, activeHomeId: id }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        setActiveHomeId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
