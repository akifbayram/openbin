import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../toast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Captures the live useToast() return so the test body can call methods directly.
function setupHarness() {
  const captured: { current: ReturnType<typeof useToast> | null } = { current: null };

  function Harness() {
    captured.current = useToast();
    return null;
  }

  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

  if (!captured.current) throw new Error('useToast() never captured');
  return captured.current;
}

describe('updateToast', () => {
  it('mutates an existing toast message and resets its auto-dismiss timer', () => {
    const api = setupHarness();
    let createdId: number | undefined;

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: showToast return type is being widened in this slice
      createdId = (api.showToast as any)({ message: 'original', duration: 4000 });
    });

    expect(typeof createdId).toBe('number');
    expect(screen.getByText('original')).toBeInTheDocument();

    // Advance partway through the original 4000ms window, then update.
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: updateToast is added to the API in this slice
      (api as any).updateToast(createdId, { message: 'updated' });
    });

    expect(screen.getByText('updated')).toBeInTheDocument();
    expect(screen.queryByText('original')).toBeNull();

    // Cross the ORIGINAL 4000ms deadline (total elapsed = 5000ms). The refreshed timer
    // started at t=3000, so only 2000ms has elapsed on it — toast must still be visible.
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('updated')).toBeInTheDocument();
  });
});
