import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import { apiFetch } from '@/lib/api';
import { useAuth, AuthProvider } from '../auth';
import type { User } from '@/types';

const mockApiFetch = vi.mocked(apiFetch);

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'testuser',
    displayName: 'Test User',
    email: null,
    avatarUrl: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');
  });

  describe('initial state', () => {
    it('reads token and activeLocationId from localStorage', () => {
      localStorage.setItem('sanduk-token', 'stored-token');
      localStorage.setItem('sanduk-active-location', 'loc-1');
      mockApiFetch.mockResolvedValue(makeUser());

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.token).toBe('stored-token');
      expect(result.current.activeLocationId).toBe('loc-1');
    });
  });

  describe('token validation on mount', () => {
    it('sets user when token is valid', async () => {
      const user = makeUser();
      localStorage.setItem('sanduk-token', 'valid-token');
      mockApiFetch.mockResolvedValue(user);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(user);
      expect(result.current.token).toBe('valid-token');
      expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/me');
    });

    it('clears token from localStorage when apiFetch rejects', async () => {
      localStorage.setItem('sanduk-token', 'invalid-token');
      mockApiFetch.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(localStorage.getItem('sanduk-token')).toBeNull();
    });

    it('sets loading to false immediately when no token', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('calls API, stores token, and sets user with activeLocationId', async () => {
      const user = makeUser();
      mockApiFetch.mockResolvedValue({
        token: 'new-token',
        user,
        activeLocationId: 'loc-1',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('testuser', 'password');
      });

      expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: { username: 'testuser', password: 'password' },
      });
      expect(localStorage.getItem('sanduk-token')).toBe('new-token');
      expect(localStorage.getItem('sanduk-active-location')).toBe('loc-1');
      expect(result.current.user).toEqual(user);
      expect(result.current.token).toBe('new-token');
      expect(result.current.activeLocationId).toBe('loc-1');
    });

    it('keeps existing activeLocationId when response has none', async () => {
      localStorage.setItem('sanduk-active-location', 'existing-loc');
      const user = makeUser();
      // First call is /api/auth/me on mount, second is login
      mockApiFetch
        .mockResolvedValueOnce(user) // /me
        .mockResolvedValueOnce({ token: 'new-token', user }); // login (no activeLocationId)

      localStorage.setItem('sanduk-token', 'old-token');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login('testuser', 'password');
      });

      expect(result.current.activeLocationId).toBe('existing-loc');
    });
  });

  describe('register', () => {
    it('calls API, stores token, clears active-location, and sets user', async () => {
      localStorage.setItem('sanduk-active-location', 'stale-loc');
      const user = makeUser();
      mockApiFetch.mockResolvedValue({
        token: 'reg-token',
        user,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.register('newuser', 'password', 'New User');
      });

      expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        body: { username: 'newuser', password: 'password', displayName: 'New User' },
      });
      expect(localStorage.getItem('sanduk-token')).toBe('reg-token');
      expect(localStorage.getItem('sanduk-active-location')).toBeNull();
      expect(result.current.user).toEqual(user);
      expect(result.current.token).toBe('reg-token');
      expect(result.current.activeLocationId).toBeNull();
    });
  });

  describe('logout', () => {
    it('removes token and active-location from localStorage and clears state', async () => {
      localStorage.setItem('sanduk-token', 'my-token');
      localStorage.setItem('sanduk-active-location', 'loc-1');
      mockApiFetch.mockResolvedValue(makeUser());

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.logout();
      });

      expect(localStorage.getItem('sanduk-token')).toBeNull();
      expect(localStorage.getItem('sanduk-active-location')).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.activeLocationId).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('setActiveLocationId', () => {
    it('stores id in localStorage and updates state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setActiveLocationId('loc-2');
      });

      expect(localStorage.getItem('sanduk-active-location')).toBe('loc-2');
      expect(result.current.activeLocationId).toBe('loc-2');
    });

    it('removes from localStorage when set to null', async () => {
      localStorage.setItem('sanduk-active-location', 'loc-1');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setActiveLocationId(null);
      });

      expect(localStorage.getItem('sanduk-active-location')).toBeNull();
      expect(result.current.activeLocationId).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('updates user in state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newUser = makeUser({ displayName: 'Updated Name' });

      act(() => {
        result.current.updateUser(newUser);
      });

      expect(result.current.user).toEqual(newUser);
      expect(result.current.user?.displayName).toBe('Updated Name');
    });
  });

  describe('deleteAccount', () => {
    it('calls API and calls logout', async () => {
      const user = makeUser({ id: 'user-42' });
      localStorage.setItem('sanduk-token', 'my-token');
      localStorage.setItem('sanduk-active-location', 'loc-1');

      // First call: /me on mount, second call: DELETE /api/auth/account
      mockApiFetch
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(user);
      });

      await act(async () => {
        await result.current.deleteAccount('mypassword');
      });

      expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/account', {
        method: 'DELETE',
        body: { password: 'mypassword' },
      });
      expect(localStorage.getItem('sanduk-token')).toBeNull();
      expect(localStorage.getItem('sanduk-active-location')).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });
  });
});
