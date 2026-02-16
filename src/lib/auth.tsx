import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiFetch } from './api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  activeLocationId: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  setActiveLocationId: (id: string | null) => void;
  updateUser: (user: User) => void;
  deleteAccount: (password: string) => Promise<void>;
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
    token: localStorage.getItem('sanduk-token'),
    activeLocationId: localStorage.getItem('sanduk-active-location'),
    loading: true,
  });

  // Validate token on mount
  useEffect(() => {
    const token = localStorage.getItem('sanduk-token');
    if (!token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    apiFetch<User>('/api/auth/me')
      .then((user) => {
        setState((s) => ({ ...s, user, token, loading: false }));
      })
      .catch(() => {
        localStorage.removeItem('sanduk-token');
        setState((s) => ({ ...s, user: null, token: null, loading: false }));
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User; activeLocationId?: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    localStorage.setItem('sanduk-token', data.token);
    if (data.activeLocationId) {
      localStorage.setItem('sanduk-active-location', data.activeLocationId);
    }
    setState((s) => ({
      ...s,
      user: data.user,
      token: data.token,
      activeLocationId: data.activeLocationId ?? s.activeLocationId,
    }));
  }, []);

  const register = useCallback(async (username: string, password: string, displayName: string) => {
    const data = await apiFetch<{ token: string; user: User; activeLocationId?: string }>('/api/auth/register', {
      method: 'POST',
      body: { username, password, displayName },
    });
    localStorage.setItem('sanduk-token', data.token);
    // New registrations have no locations — clear any stale value from a previous session
    localStorage.removeItem('sanduk-active-location');
    setState((s) => ({
      ...s,
      user: data.user,
      token: data.token,
      activeLocationId: null,
    }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sanduk-token');
    localStorage.removeItem('sanduk-active-location');
    setState({ user: null, token: null, activeLocationId: null, loading: false });
  }, []);

  const setActiveLocationId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('sanduk-active-location', id);
    } else {
      localStorage.removeItem('sanduk-active-location');
    }
    setState((s) => ({ ...s, activeLocationId: id }));
  }, []);

  const updateUser = useCallback((user: User) => {
    setState((s) => ({ ...s, user }));
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await apiFetch('/api/auth/account', { method: 'DELETE', body: { password } });
    logout();
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        setActiveLocationId,
        updateUser,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
