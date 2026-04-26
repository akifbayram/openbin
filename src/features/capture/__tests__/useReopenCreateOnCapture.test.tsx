import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCapturedReturnTarget,
  hasCapturedPhotos,
  setCapturedPhotos,
  setCapturedReturnTarget,
  takeCapturedPhotos,
} from '../capturedPhotos';
import { useReopenCreateOnCapture } from '../useAutoOpenOnCapture';

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={['/bins']}>{children}</MemoryRouter>;
}

afterEach(() => {
  takeCapturedPhotos(); // reset module state between tests
});

describe('useReopenCreateOnCapture', () => {
  it('invokes the callback with files and clears module state when target is bin-create', () => {
    const file = new File(['x'], 'capture-1.jpg', { type: 'image/jpeg' });
    setCapturedPhotos([file]);
    setCapturedReturnTarget('bin-create');
    const onReopen = vi.fn();

    renderHook(() => useReopenCreateOnCapture(onReopen), { wrapper });

    expect(onReopen).toHaveBeenCalledTimes(1);
    expect(onReopen).toHaveBeenCalledWith([file], null);
    expect(hasCapturedPhotos()).toBe(false);
    expect(getCapturedReturnTarget()).toBe(null);
  });

  it('invokes the callback with [] when target is bin-create but no photos pending (cancel path)', () => {
    setCapturedReturnTarget('bin-create');
    const onReopen = vi.fn();

    renderHook(() => useReopenCreateOnCapture(onReopen), { wrapper });

    expect(onReopen).toHaveBeenCalledTimes(1);
    expect(onReopen).toHaveBeenCalledWith([], null);
  });

  it('passes groups through to onReopen', () => {
    const onReopen = vi.fn();
    setCapturedPhotos([new File(['a'], 'a.jpg', { type: 'image/jpeg' })], [0]);
    setCapturedReturnTarget('bin-create');
    renderHook(() => useReopenCreateOnCapture(onReopen), { wrapper });
    expect(onReopen).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(File)]),
      [0],
    );
  });

  it('does not invoke the callback when target is bulk-add', () => {
    setCapturedPhotos([new File(['x'], 'a.jpg')]);
    setCapturedReturnTarget('bulk-add');
    const onReopen = vi.fn();

    renderHook(() => useReopenCreateOnCapture(onReopen), { wrapper });

    expect(onReopen).not.toHaveBeenCalled();
    expect(hasCapturedPhotos()).toBe(true); // unchanged
    expect(getCapturedReturnTarget()).toBe('bulk-add');
  });

  it('does not invoke the callback when target is null', () => {
    const onReopen = vi.fn();
    renderHook(() => useReopenCreateOnCapture(onReopen), { wrapper });
    expect(onReopen).not.toHaveBeenCalled();
  });
});
