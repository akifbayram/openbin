import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCaptureGrouping } from '../useCaptureGrouping';

// Mock useCapture so we can control its returned photo list deterministically
let mockPhotos: Array<{ id: string; groupId?: number; status: string; blob: Blob; thumbnailUrl: string }> = [];
const mockCapture = vi.fn();
const mockAppendImported = vi.fn((blob: Blob, groupId?: number) => {
  const id = `import-${mockPhotos.length}`;
  mockPhotos.push({ id, groupId, status: 'uploaded', blob, thumbnailUrl: `blob:${id}` });
});
const mockRemovePhoto = vi.fn((id: string) => {
  mockPhotos = mockPhotos.filter((p) => p.id !== id);
});

vi.mock('../useCapture', () => ({
  useCapture: () => ({
    videoRef: { current: null },
    isStreaming: true,
    facingMode: 'environment',
    photos: mockPhotos,
    error: null,
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    flipCamera: vi.fn(),
    capture: mockCapture,
    retryUpload: vi.fn(),
    appendImportedPhoto: mockAppendImported,
    removePhoto: mockRemovePhoto,
    cleanup: vi.fn(),
  }),
}));

beforeEach(() => {
  mockPhotos = [];
  mockCapture.mockClear();
  mockAppendImported.mockClear();
  mockRemovePhoto.mockClear();
});

describe('useCaptureGrouping', () => {
  it('starts with currentGroup = 0', () => {
    const { result } = renderHook(() => useCaptureGrouping());
    expect(result.current.currentGroup).toBe(0);
  });

  it('nextGroup() increments currentGroup', () => {
    const { result } = renderHook(() => useCaptureGrouping());
    act(() => {
      result.current.nextGroup();
    });
    expect(result.current.currentGroup).toBe(1);
    act(() => {
      result.current.nextGroup();
    });
    expect(result.current.currentGroup).toBe(2);
  });
});

describe('useCaptureGrouping capture stamping', () => {
  it('passes currentGroup to underlying capture()', () => {
    const { result } = renderHook(() => useCaptureGrouping());
    act(() => {
      result.current.capture();
    });
    expect(mockCapture).toHaveBeenCalledWith(0);
  });

  it('passes new currentGroup after nextGroup()', () => {
    const { result } = renderHook(() => useCaptureGrouping());
    act(() => {
      result.current.nextGroup();
    });
    act(() => {
      result.current.capture();
    });
    expect(mockCapture).toHaveBeenLastCalledWith(1);
  });

  it('exposes photosInCurrentGroup count', () => {
    const { result, rerender } = renderHook(() => useCaptureGrouping());
    mockPhotos = [
      { id: 'p1', groupId: 0, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p1' },
      { id: 'p2', groupId: 0, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p2' },
    ];
    rerender();
    expect(result.current.photosInCurrentGroup).toBe(2);

    act(() => {
      result.current.nextGroup();
    });
    expect(result.current.photosInCurrentGroup).toBe(0);
  });
});

describe('useCaptureGrouping derived groups', () => {
  it('buckets photos into groups in insertion order', () => {
    const { result, rerender } = renderHook(() => useCaptureGrouping());
    mockPhotos = [
      { id: 'p1', groupId: 0, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p1' },
      { id: 'p2', groupId: 0, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p2' },
      { id: 'p3', groupId: 1, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p3' },
    ];
    rerender();
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.groups[0].photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.groups[1].photos.map((p) => p.id)).toEqual(['p3']);
  });

  it('orders groups by first-seen insertion order (not numeric groupId)', () => {
    const { result, rerender } = renderHook(() => useCaptureGrouping());
    mockPhotos = [
      { id: 'p1', groupId: 2, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p1' },
      { id: 'p2', groupId: 0, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p2' },
    ];
    rerender();
    expect(result.current.groups[0].id).toBe(2);
    expect(result.current.groups[1].id).toBe(0);
  });

  it('excludes photos without a groupId from derived groups', () => {
    const { result, rerender } = renderHook(() => useCaptureGrouping());
    mockPhotos = [
      { id: 'p1', status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p1' },
    ];
    rerender();
    expect(result.current.groups).toHaveLength(0);
  });
});

describe('useCaptureGrouping importFiles', () => {
  it('appends files into the current group', () => {
    const { result } = renderHook(() => useCaptureGrouping());
    act(() => {
      result.current.importFiles([
        new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      ]);
    });
    expect(mockAppendImported).toHaveBeenCalledTimes(1);
    expect(mockAppendImported).toHaveBeenCalledWith(expect.any(File), 0);
  });

  it('stamps imported files with the current group', () => {
    const { result } = renderHook(() => useCaptureGrouping());
    act(() => {
      result.current.nextGroup();
    });
    act(() => {
      result.current.importFiles([
        new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      ]);
    });
    expect(mockAppendImported).toHaveBeenCalledWith(expect.any(File), 1);
  });
});

describe('useCaptureGrouping removePhoto', () => {
  it('forwards removePhoto to useCapture', () => {
    mockPhotos = [
      { id: 'p1', groupId: 0, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p1' },
      { id: 'p2', groupId: 0, status: 'uploaded', blob: new Blob(), thumbnailUrl: 'blob:p2' },
    ];
    const { result, rerender } = renderHook(() => useCaptureGrouping());
    rerender();
    act(() => {
      result.current.removePhoto('p1');
    });
    expect(mockRemovePhoto).toHaveBeenCalledWith('p1');
  });
});
