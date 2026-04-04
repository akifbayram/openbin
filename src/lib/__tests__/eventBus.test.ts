import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Events, notify, useRefreshOn } from '../eventBus';

/** Flush the queueMicrotask used by notify() */
async function flushNotify() {
  await new Promise<void>((r) => queueMicrotask(r));
}

describe('notify', () => {
  it('dispatches event on window', async () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    notify(Events.BINS);
    await flushNotify();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'bins-changed' }));
    spy.mockRestore();
  });
});

describe('useRefreshOn', () => {
  it('returns 0 initially', () => {
    const { result } = renderHook(() => useRefreshOn(Events.BINS));
    expect(result.current).toBe(0);
  });

  it('increments counter when matching event fires', async () => {
    const { result } = renderHook(() => useRefreshOn(Events.BINS));
    await act(async () => { notify(Events.BINS); await flushNotify(); });
    expect(result.current).toBe(1);
    await act(async () => { notify(Events.BINS); await flushNotify(); });
    expect(result.current).toBe(2);
  });

  it('does not increment for non-matching events', async () => {
    const { result } = renderHook(() => useRefreshOn(Events.BINS));
    await act(async () => { notify(Events.PHOTOS); await flushNotify(); });
    expect(result.current).toBe(0);
  });

  it('multiple hooks on same event all update', async () => {
    const { result: r1 } = renderHook(() => useRefreshOn(Events.BINS));
    const { result: r2 } = renderHook(() => useRefreshOn(Events.BINS));
    await act(async () => { notify(Events.BINS); await flushNotify(); });
    expect(r1.current).toBe(1);
    expect(r2.current).toBe(1);
  });

  it('listener removed on unmount', async () => {
    const { result, unmount } = renderHook(() => useRefreshOn(Events.BINS));
    await act(async () => { notify(Events.BINS); await flushNotify(); });
    expect(result.current).toBe(1);
    unmount();
    // Fire again after unmount — counter should stay at 1
    await act(async () => { notify(Events.BINS); await flushNotify(); });
    expect(result.current).toBe(1);
  });

  it('increments on any of multiple event types', async () => {
    const { result } = renderHook(() => useRefreshOn(Events.BINS, Events.PHOTOS));
    await act(async () => { notify(Events.BINS); await flushNotify(); });
    expect(result.current).toBe(1);
    await act(async () => { notify(Events.PHOTOS); await flushNotify(); });
    expect(result.current).toBe(2);
    await act(async () => { notify(Events.AREAS); await flushNotify(); });
    expect(result.current).toBe(2);
  });
});
