import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BinItem } from '@/types';
import { useAiFillState } from '../useAiFillState';

const item = (name: string, quantity: number | null = null): BinItem => ({
  id: name,
  name,
  quantity,
});

describe('useAiFillState', () => {
  it('starts with no fields filled', () => {
    const { result } = renderHook(() => useAiFillState());
    expect(result.current.filled.size).toBe(0);
  });

  it('markFilled flags the given fields', () => {
    const { result } = renderHook(() => useAiFillState());
    act(() => result.current.markFilled(['name', 'items']));
    expect(result.current.filled.has('name')).toBe(true);
    expect(result.current.filled.has('items')).toBe(true);
  });

  it('undo returns the snapshot and clears that field only', () => {
    const { result } = renderHook(() => useAiFillState());
    const snap = { name: 'before', items: [item('a')] };
    act(() => result.current.snapshot(snap));
    act(() => result.current.markFilled(['name', 'items']));

    let returned: ReturnType<typeof result.current.undo> = null;
    act(() => {
      returned = result.current.undo('name');
    });

    expect(returned).toEqual(snap);
    expect(result.current.filled.has('name')).toBe(false);
    expect(result.current.filled.has('items')).toBe(true);
  });

  it('undo returns null when no snapshot exists', () => {
    const { result } = renderHook(() => useAiFillState());
    let returned: ReturnType<typeof result.current.undo> = null;
    act(() => {
      returned = result.current.undo('name');
    });
    expect(returned).toBeNull();
  });

  it('keyFor bumps after each markFilled cycle so the CSS animation replays', () => {
    const { result } = renderHook(() => useAiFillState());
    const baseline = result.current.keyFor('name');
    expect(baseline).toBe('name');

    act(() => result.current.markFilled(['name']));
    const first = result.current.keyFor('name');

    act(() => result.current.markFilled(['name']));
    const second = result.current.keyFor('name');

    expect(first).not.toBe(second);
    expect(first.startsWith('name-')).toBe(true);
    expect(second.startsWith('name-')).toBe(true);
  });

  it('styleFor sets --stagger only when the field is filled', () => {
    const { result } = renderHook(() => useAiFillState());
    expect(result.current.styleFor('name', 0)).toBeUndefined();

    act(() => result.current.markFilled(['name']));
    const style = result.current.styleFor('name', 1) as Record<string, unknown>;
    expect(style['--stagger']).toBe(1);
  });

  it('reset clears filled and discards the snapshot', () => {
    const { result } = renderHook(() => useAiFillState());
    act(() => result.current.snapshot({ name: 'x', items: [] }));
    act(() => result.current.markFilled(['name']));

    act(() => result.current.reset());

    expect(result.current.filled.size).toBe(0);
    let returned: ReturnType<typeof result.current.undo> = null;
    act(() => {
      returned = result.current.undo('name');
    });
    expect(returned).toBeNull();
  });
});
