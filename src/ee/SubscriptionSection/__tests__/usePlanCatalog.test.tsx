import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_CATALOG } from './fixtures/planCatalog';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async () => FIXTURE_CATALOG),
}));

import { apiFetch } from '@/lib/api';
import { __resetPlanCatalogCache, usePlanCatalog } from '../hooks/usePlanCatalog';

afterEach(() => {
  __resetPlanCatalogCache();
  vi.mocked(apiFetch).mockClear();
});

describe('usePlanCatalog', () => {
  it('fetches /api/plans on first mount and exposes plans', async () => {
    const { result } = renderHook(() => usePlanCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plans).toEqual(FIXTURE_CATALOG.plans);
    expect(apiFetch).toHaveBeenCalledWith('/api/plans');
  });

  it('returns cached value on second mount without refetch', async () => {
    const { result: r1 } = renderHook(() => usePlanCatalog());
    await waitFor(() => expect(r1.current.isLoading).toBe(false));

    vi.mocked(apiFetch).mockClear();

    const { result: r2 } = renderHook(() => usePlanCatalog());
    await waitFor(() => expect(r2.current.isLoading).toBe(false));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(r2.current.plans).toEqual(FIXTURE_CATALOG.plans);
  });

  it('exposes empty plans + error on fetch failure', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => usePlanCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plans).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
