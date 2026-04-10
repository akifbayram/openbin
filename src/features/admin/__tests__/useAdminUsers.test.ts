import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/api';
import {
  capitalize,
  deleteUser,
  fetchAdminCount,
  fetchUser,
  statusVariant,
  updateUser,
} from '../useAdminUsers';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('statusVariant', () => {
  it('returns "default" for active', () => {
    expect(statusVariant('active')).toBe('default');
  });

  it('returns "outline" for trial', () => {
    expect(statusVariant('trial')).toBe('outline');
  });

  it('returns "secondary" for inactive', () => {
    expect(statusVariant('inactive')).toBe('secondary');
  });

  it('returns "secondary" for unknown status', () => {
    expect(statusVariant('expired')).toBe('secondary');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('handles single char', () => {
    expect(capitalize('x')).toBe('X');
  });
});

describe('fetchUser', () => {
  it('calls correct endpoint', async () => {
    const mockDetail = { id: 'u1', username: 'admin', stats: {} };
    mockApiFetch.mockResolvedValue(mockDetail);

    const result = await fetchUser('u1');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/users/u1');
    expect(result).toEqual(mockDetail);
  });
});

describe('updateUser', () => {
  it('calls PUT with updates', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await updateUser('u1', { isAdmin: true });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/users/u1', {
      method: 'PUT',
      body: { isAdmin: true },
    });
  });
});

describe('deleteUser', () => {
  it('calls DELETE', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await deleteUser('u1');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/users/u1', {
      method: 'DELETE',
    });
  });
});

describe('fetchAdminCount', () => {
  it('extracts adminCount from response', async () => {
    mockApiFetch.mockResolvedValue({ results: [], count: 5, adminCount: 2 });

    const count = await fetchAdminCount();

    expect(count).toBe(2);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/users?page=1');
  });
});
