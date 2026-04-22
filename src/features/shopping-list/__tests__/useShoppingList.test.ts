import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events, notify } from '@/lib/eventBus';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'u1' } }),
}));

import { apiFetch } from '@/lib/api';
import {
  addItemsToShoppingList,
  addToShoppingList,
  markAsBought,
  removeFromShoppingList,
  useShoppingList,
} from '../useShoppingList';

const mockedApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedApiFetch.mockReset();
});

describe('useShoppingList', () => {
  it('fetches entries for a location', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      results: [
        {
          id: 'e1', location_id: 'loc1', name: 'Milk',
          origin_bin_id: 'b1', origin_bin_name: 'Pantry',
          origin_bin_icon: '', origin_bin_color: '',
          origin_bin_trashed: false,
          created_by: 'u1', created_by_name: 'Me',
          created_at: '2026-04-22T00:00:00Z',
        },
      ],
      count: 1,
    });

    const { result } = renderHook(() => useShoppingList('loc1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].name).toBe('Milk');
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/locations/loc1/shopping-list');
  });

  it('refetches on SHOPPING_LIST event', async () => {
    mockedApiFetch.mockResolvedValue({ results: [], count: 0 });

    const { result } = renderHook(() => useShoppingList('loc1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      notify(Events.SHOPPING_LIST);
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledTimes(2));
  });

  it('does not fetch when locationId is null', async () => {
    const { result } = renderHook(() => useShoppingList(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([]);
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });
});

describe('mutations', () => {
  it('addItemsToShoppingList hits bulk endpoint', async () => {
    mockedApiFetch.mockResolvedValueOnce({ entries: [{ id: 'e1', name: 'Milk' }], count: 1 });

    const result = await addItemsToShoppingList('bin1', ['Milk']);

    expect(result).toHaveLength(1);
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/bins/bin1/shopping-list', {
      method: 'POST',
      body: { names: ['Milk'] },
    });
  });

  it('addToShoppingList hits manual endpoint', async () => {
    mockedApiFetch.mockResolvedValueOnce({ entry: { id: 'e1', name: 'Milk' } });

    await addToShoppingList('loc1', 'Milk', 'bin1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/api/locations/loc1/shopping-list', {
      method: 'POST',
      body: { name: 'Milk', originBinId: 'bin1' },
    });
  });

  it('markAsBought returns restored payload', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      deleted: true,
      restored: { binId: 'b1', itemId: 'i1', name: 'Milk' },
    });

    const res = await markAsBought('e1');

    expect(res.restored?.binId).toBe('b1');
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/shopping-list/e1/purchase', {
      method: 'POST',
    });
  });

  it('removeFromShoppingList deletes', async () => {
    mockedApiFetch.mockResolvedValueOnce({ ok: true });

    await removeFromShoppingList('e1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/api/shopping-list/e1', { method: 'DELETE' });
  });
});
