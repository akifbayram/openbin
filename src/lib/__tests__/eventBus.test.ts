import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Events, notify, useRefreshOn } from '../eventBus';

describe('notify', () => {
  it('dispatches event on window', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    notify(Events.BINS);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'bins-changed' }));
    spy.mockRestore();
  });
});

describe('useRefreshOn', () => {
  it('returns 0 initially', () => {
    const { result } = renderHook(() => useRefreshOn(Events.BINS));
    expect(result.current).toBe(0);
  });

  it('increments counter when matching event fires', () => {
    const { result } = renderHook(() => useRefreshOn(Events.BINS));
    act(() => notify(Events.BINS));
    expect(result.current).toBe(1);
    act(() => notify(Events.BINS));
    expect(result.current).toBe(2);
  });

  it('does not increment for non-matching events', () => {
    const { result } = renderHook(() => useRefreshOn(Events.BINS));
    act(() => notify(Events.PHOTOS));
    expect(result.current).toBe(0);
  });

  it('multiple hooks on same event all update', () => {
    const { result: r1 } = renderHook(() => useRefreshOn(Events.BINS));
    const { result: r2 } = renderHook(() => useRefreshOn(Events.BINS));
    act(() => notify(Events.BINS));
    expect(r1.current).toBe(1);
    expect(r2.current).toBe(1);
  });

  it('listener removed on unmount', () => {
    const { result, unmount } = renderHook(() => useRefreshOn(Events.BINS));
    act(() => notify(Events.BINS));
    expect(result.current).toBe(1);
    unmount();
    // Fire again after unmount — counter should stay at 1
    act(() => notify(Events.BINS));
    expect(result.current).toBe(1);
  });

  it('increments on any of multiple event types', () => {
    const { result } = renderHook(() => useRefreshOn(Events.BINS, Events.PHOTOS));
    act(() => notify(Events.BINS));
    expect(result.current).toBe(1);
    act(() => notify(Events.PHOTOS));
    expect(result.current).toBe(2);
    act(() => notify(Events.AREAS));
    expect(result.current).toBe(2);
  });
});
