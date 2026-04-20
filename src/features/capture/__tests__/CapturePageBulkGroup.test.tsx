import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CapturePageBulkGroup } from '../CapturePageBulkGroup';
import { takeCapturedPhotos } from '../capturedPhotos';

// Mock the grouping hook to drive the UI deterministically
const mockHook = {
  videoRef: { current: null },
  isStreaming: true,
  photos: [] as Array<{ id: string; blob: Blob; thumbnailUrl: string; status: string; groupId?: number }>,
  error: null as string | null,
  currentGroup: 0,
  photosInCurrentGroup: 0,
  groups: [] as Array<{ id: number; photos: Array<{ id: string; blob: Blob; thumbnailUrl: string; status: string; groupId?: number }> }>,
  startCamera: vi.fn(),
  stopCamera: vi.fn(),
  capture: vi.fn(),
  nextGroup: vi.fn(),
  importFiles: vi.fn(),
  cleanup: vi.fn(),
  removePhoto: vi.fn(),
};

vi.mock('../useCaptureGrouping', () => ({
  useCaptureGrouping: () => mockHook,
}));

beforeEach(() => {
  mockHook.photos = [];
  mockHook.currentGroup = 0;
  mockHook.photosInCurrentGroup = 0;
  mockHook.groups = [];
  mockHook.isStreaming = true;
  mockHook.error = null;
  mockHook.capture.mockClear();
  mockHook.nextGroup.mockClear();
  mockHook.importFiles.mockClear();
  mockHook.removePhoto.mockClear();
  // happy-dom doesn't provide navigator.mediaDevices — stub it so the pre-stream
  // overlay renders the "Ready to capture" / error branches instead of "Camera not available".
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  }
});

function renderUI() {
  return render(
    <MemoryRouter>
      <CapturePageBulkGroup />
    </MemoryRouter>,
  );
}

describe('CapturePageBulkGroup top bar', () => {
  it('shows Bin #1 · 0 photos at start', () => {
    renderUI();
    expect(screen.getByText(/Bin #1/)).toBeTruthy();
    expect(screen.getByText(/0 photos/)).toBeTruthy();
  });

  it('shows pluralization correctly at 1 photo', () => {
    mockHook.photosInCurrentGroup = 1;
    renderUI();
    expect(screen.getByText(/1 photo/)).toBeTruthy();
    expect(screen.queryByText(/1 photos/)).toBeNull();
  });

  it('increments bin number with currentGroup', () => {
    mockHook.currentGroup = 4;
    mockHook.photosInCurrentGroup = 1;
    renderUI();
    expect(screen.getByText(/Bin #5/)).toBeTruthy();
  });
});

describe('CapturePageBulkGroup viewfinder hint', () => {
  it('shows "tap shutter to capture" when fresh', () => {
    renderUI();
    expect(screen.getByText(/tap shutter to capture/i)).toBeTruthy();
  });

  it('shows "keep shooting — same bin" while group 0 has photos', () => {
    mockHook.currentGroup = 0;
    mockHook.photosInCurrentGroup = 2;
    renderUI();
    expect(screen.getByText(/keep shooting/i)).toBeTruthy();
  });

  it('shows "new bin — aim & shoot" after next bin tapped', () => {
    mockHook.currentGroup = 1;
    mockHook.photosInCurrentGroup = 0;
    renderUI();
    expect(screen.getByText(/new bin/i)).toBeTruthy();
  });

  it('shows "Done when finished" with multi-bin progress', () => {
    mockHook.currentGroup = 3;
    mockHook.photosInCurrentGroup = 1;
    renderUI();
    expect(screen.getByText(/done when finished/i)).toBeTruthy();
  });
});

describe('CapturePageBulkGroup photo strip', () => {
  it('shows empty placeholder when no photos', () => {
    renderUI();
    expect(screen.getByText(/no photos yet/i)).toBeTruthy();
  });

  it('renders one thumbnail per photo', () => {
    const blob = new Blob();
    mockHook.groups = [
      {
        id: 0,
        photos: [
          { id: 'p1', blob, thumbnailUrl: 'blob:p1', status: 'uploaded', groupId: 0 },
          { id: 'p2', blob, thumbnailUrl: 'blob:p2', status: 'uploaded', groupId: 0 },
        ],
      },
    ];
    mockHook.photos = mockHook.groups.flatMap((g) => g.photos);
    renderUI();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders a divider between groups', () => {
    const blob = new Blob();
    mockHook.groups = [
      {
        id: 0,
        photos: [{ id: 'p1', blob, thumbnailUrl: 'blob:p1', status: 'uploaded', groupId: 0 }],
      },
      {
        id: 1,
        photos: [{ id: 'p2', blob, thumbnailUrl: 'blob:p2', status: 'uploaded', groupId: 1 }],
      },
    ];
    mockHook.photos = mockHook.groups.flatMap((g) => g.photos);
    renderUI();
    expect(screen.getByTestId('group-divider-0-1')).toBeTruthy();
  });
});

describe('CapturePageBulkGroup bottom controls', () => {
  beforeEach(() => {
    takeCapturedPhotos(); // reset store between tests
  });

  it('Done is disabled when no photos', () => {
    renderUI();
    const done = screen.getByRole('button', { name: /^done$/i });
    expect(done.hasAttribute('disabled')).toBe(true);
  });

  it('Done is enabled with photos', () => {
    mockHook.photos = [
      { id: 'p1', blob: new Blob(), thumbnailUrl: 'blob:p1', status: 'uploaded', groupId: 0 },
    ];
    mockHook.groups = [{ id: 0, photos: mockHook.photos }];
    mockHook.photosInCurrentGroup = 1;
    renderUI();
    const done = screen.getByRole('button', { name: /^done$/i });
    expect(done.hasAttribute('disabled')).toBe(false);
  });

  it('Next bin is disabled when current group empty', () => {
    renderUI();
    const nextBtn = screen.getByRole('button', { name: /^next bin$/i });
    expect(nextBtn.hasAttribute('disabled')).toBe(true);
  });

  it('Next bin is enabled when current group has photos', () => {
    mockHook.photos = [
      { id: 'p1', blob: new Blob(), thumbnailUrl: 'blob:p1', status: 'uploaded', groupId: 0 },
    ];
    mockHook.photosInCurrentGroup = 1;
    renderUI();
    const nextBtn = screen.getByRole('button', { name: /^next bin$/i });
    expect(nextBtn.hasAttribute('disabled')).toBe(false);
  });

  it('tapping Next bin calls hook.nextGroup', () => {
    mockHook.photos = [
      { id: 'p1', blob: new Blob(), thumbnailUrl: 'blob:p1', status: 'uploaded', groupId: 0 },
    ];
    mockHook.photosInCurrentGroup = 1;
    renderUI();
    fireEvent.click(screen.getByRole('button', { name: /^next bin$/i }));
    expect(mockHook.nextGroup).toHaveBeenCalled();
  });

  it('tapping shutter calls hook.capture', () => {
    renderUI();
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
    expect(mockHook.capture).toHaveBeenCalled();
  });

  it('Done packages photos+groups into capturedPhotos store', () => {
    const blob1 = new Blob(['a'], { type: 'image/jpeg' });
    const blob2 = new Blob(['b'], { type: 'image/jpeg' });
    mockHook.photos = [
      { id: 'p1', blob: blob1, thumbnailUrl: 'blob:p1', status: 'uploaded', groupId: 0 },
      { id: 'p2', blob: blob2, thumbnailUrl: 'blob:p2', status: 'uploaded', groupId: 1 },
    ];
    mockHook.groups = [
      { id: 0, photos: [mockHook.photos[0]] },
      { id: 1, photos: [mockHook.photos[1]] },
    ];
    mockHook.photosInCurrentGroup = 1;
    renderUI();
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));

    const taken = takeCapturedPhotos();
    expect(taken.files).toHaveLength(2);
    expect(taken.groups).toEqual([0, 1]);
  });
});

describe('CapturePageBulkGroup long-press removal', () => {
  it('long-press on thumbnail reveals a remove button', () => {
    vi.useFakeTimers();
    const blob = new Blob();
    const photo = { id: 'p1', blob, thumbnailUrl: 'blob:p1', status: 'uploaded' as const, groupId: 0 };
    mockHook.photos = [photo];
    mockHook.groups = [{ id: 0, photos: [photo] }];
    mockHook.photosInCurrentGroup = 1;
    renderUI();

    const thumb = screen.getByLabelText(/Bin 1, photo 1/i);
    fireEvent.pointerDown(thumb);
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const removeBtn = screen.getByRole('button', { name: /remove photo/i });
    expect(removeBtn).toBeTruthy();
    vi.useRealTimers();
  });

  it('tapping remove calls hook.removePhoto', () => {
    vi.useFakeTimers();
    const blob = new Blob();
    const photo = { id: 'p1', blob, thumbnailUrl: 'blob:p1', status: 'uploaded' as const, groupId: 0 };
    mockHook.photos = [photo];
    mockHook.groups = [{ id: 0, photos: [photo] }];
    mockHook.photosInCurrentGroup = 1;
    renderUI();

    const thumb = screen.getByLabelText(/Bin 1, photo 1/i);
    fireEvent.pointerDown(thumb);
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const removeBtn = screen.getByRole('button', { name: /remove photo/i });
    fireEvent.click(removeBtn);

    expect(mockHook.removePhoto).toHaveBeenCalledWith('p1');
    vi.useRealTimers();
  });
});

describe('CapturePageBulkGroup pre-stream', () => {
  it('shows start camera screen before streaming', () => {
    mockHook.isStreaming = false;
    renderUI();
    expect(screen.getByText(/ready to capture/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /start camera/i })).toBeTruthy();
  });

  it('shows error screen when error is set', () => {
    mockHook.isStreaming = false;
    mockHook.error = 'Camera access denied.';
    renderUI();
    expect(screen.getByText(/camera access denied/i)).toBeTruthy();
  });
});
