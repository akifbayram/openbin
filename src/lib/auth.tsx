import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiFetch } from './api';
import { STORAGE_KEYS } from './storageKeys';
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
    token: localStorage.getItem(STORAGE_KEYS.TOKEN),
    activeLocationId: localStorage.getItem(STORAGE_KEYS.ACTIVE_LOCATION),
    loading: true,
  });

  // Validate token on mount
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    apiFetch<User & { activeLocationId?: string | null }>('/api/auth/me')
      .then((data) => {
        const { activeLocationId: serverLocationId, ...user } = data;
        if (serverLocationId) {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_LOCATION, serverLocationId);
        }
        setState((s) => ({
          ...s,
          user,
          token,
          activeLocationId: serverLocationId ?? s.activeLocationId,
          loading: false,
        }));
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        setState((s) => ({ ...s, user: null, token: null, loading: false }));
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User; activeLocationId?: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
    if (data.activeLocationId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_LOCATION, data.activeLocationId);
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
    localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
    // New registrations have no locations — clear any stale value from a previous session
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_LOCATION);
    setState((s) => ({
      ...s,
      user: data.user,
      token: data.token,
      activeLocationId: null,
    }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_LOCATION);
    setState({ user: null, token: null, activeLocationId: null, loading: false });
  }, []);

  const setActiveLocationId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_LOCATION, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_LOCATION);
    }
    setState((s) => {
      if (s.token) {
        apiFetch('/api/auth/active-location', { method: 'PUT', body: { locationId: id } }).catch(() => {});
      }
      return { ...s, activeLocationId: id };
    });
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
