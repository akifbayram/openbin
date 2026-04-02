import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BinItem } from '@/types';
import { useQuickAdd } from '../useQuickAdd';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 'test' })) }));
vi.mock('@/components/ui/toast', () => ({ useToast: vi.fn(() => ({ showToast: vi.fn() })) }));
vi.mock('../useBins', () => ({ addItemsToBin: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/features/ai/useTextStructuring', () => ({
  useTextStructuring: vi.fn(() => ({
    structuredItems: null,
    isStructuring: false,
    error: null,
    structure: vi.fn(),
    clearStructured: vi.fn(),
  })),
}));

const { addItemsToBin } = await import('../useBins');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useQuickAdd with onAdd callback (form mode)', () => {
  it('handleAdd calls onAdd with BinItem[] when provided', async () => {
    const onAdd = vi.fn();
    const { result } = renderHook(() =>
      useQuickAdd({
        binName: 'Test',
        existingItems: [],
        activeLocationId: 'loc-1',
        aiConfigured: false,
        onNavigateAiSetup: vi.fn(),
        onAdd,
      }),
    );
    act(() => result.current.setValue('New Item'));
    await act(() => result.current.handleAdd());
    expect(onAdd).toHaveBeenCalledTimes(1);
    const items: BinItem[] = onAdd.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'New Item', quantity: null });
    expect(items[0].id).toBeTruthy();
  });

  it('handleAdd does not call addItemsToBin when onAdd is provided', async () => {
    const onAdd = vi.fn();
    const { result } = renderHook(() =>
      useQuickAdd({
        binName: 'Test',
        existingItems: [],
        activeLocationId: 'loc-1',
        aiConfigured: false,
        onNavigateAiSetup: vi.fn(),
        onAdd,
      }),
    );
    act(() => result.current.setValue('New Item'));
    await act(() => result.current.handleAdd());
    expect(addItemsToBin).not.toHaveBeenCalled();
  });

  it('handleAdd parses quantity from input text', async () => {
    const onAdd = vi.fn();
    const { result } = renderHook(() =>
      useQuickAdd({
        binName: 'Test',
        existingItems: [],
        activeLocationId: 'loc-1',
        aiConfigured: false,
        onNavigateAiSetup: vi.fn(),
        onAdd,
      }),
    );
    act(() => result.current.setValue('Screws x5'));
    await act(() => result.current.handleAdd());
    expect(onAdd).toHaveBeenCalledTimes(1);
    const items: BinItem[] = onAdd.mock.calls[0][0];
    expect(items[0]).toMatchObject({ name: 'Screws', quantity: 5 });
  });

  it('handleAdd splits comma-separated items', async () => {
    const onAdd = vi.fn();
    const { result } = renderHook(() =>
      useQuickAdd({
        binName: 'Test',
        existingItems: [],
        activeLocationId: 'loc-1',
        aiConfigured: false,
        onNavigateAiSetup: vi.fn(),
        onAdd,
      }),
    );
    act(() => result.current.setValue('Apple, Banana, Cherry'));
    await act(() => result.current.handleAdd());
    expect(onAdd).toHaveBeenCalledTimes(1);
    const items: BinItem[] = onAdd.mock.calls[0][0];
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.name)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('handleAdd without onAdd or binId is a no-op', async () => {
    const { result } = renderHook(() =>
      useQuickAdd({
        binName: 'Test',
        existingItems: [],
        activeLocationId: 'loc-1',
        aiConfigured: false,
        onNavigateAiSetup: vi.fn(),
      }),
    );
    act(() => result.current.setValue('New Item'));
    await act(() => result.current.handleAdd());
    expect(addItemsToBin).not.toHaveBeenCalled();
  });
});
