import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { GroupReviewStep } from '../GroupReviewStep';
import { type BulkAddState, createGroupFromPhoto, createPhoto, type Group, initialState } from '../useBulkGroupAdd';

vi.mock('@/lib/aiToggle', () => ({
  useAiEnabled: () => ({ aiEnabled: true, setAiEnabled: vi.fn() }),
}));

vi.mock('@/features/bins/useBins', () => ({
  useAllTags: () => [],
}));

vi.mock('@/features/areas/AreaPicker', () => ({
  AreaPicker: () => <div data-testid="area-picker" />,
}));

vi.mock('@/features/bins/IconPicker', () => ({
  IconPicker: () => <div data-testid="icon-picker" />,
}));

vi.mock('@/features/bins/ColorPicker', () => ({
  ColorPicker: () => <div data-testid="color-picker" />,
}));

vi.mock('@/features/bins/ItemList', () => ({
  ItemList: ({ items }: { items: unknown[] }) => <div data-testid="item-list">{items.length} items</div>,
}));

vi.mock('@/features/bins/QuickAddWidget', () => ({
  QuickAddWidget: () => <div data-testid="quick-add" />,
}));

vi.mock('@/features/bins/useQuickAdd', () => ({
  useQuickAdd: () => ({}),
}));

vi.mock('@/features/bins/TagInput', () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));

vi.mock('@/features/ai/AiStreamingPreview', () => ({
  AiAnalyzeError: () => <div />,
}));

vi.mock('@/features/ai/AiSettingsSection', () => ({
  AiSettingsSection: () => <div />,
}));

vi.mock('@/features/ai/AiBadge', () => ({
  AiBadge: () => <div />,
}));

const mockStream = vi.fn();
const mockCancel = vi.fn();
let mockStreamError: string | null = null;
/**
 * Per-stream state, keyed by endpoint. Only set the mode you want active
 * (e.g. mockStreamState.analyze) — the others stay idle.
 */
let mockStreamState: {
  analyze: { isStreaming: boolean; partialText: string };
  reanalyze: { isStreaming: boolean; partialText: string };
  correction: { isStreaming: boolean; partialText: string };
};
const idleStream = { isStreaming: false, partialText: '' };

vi.mock('@/features/ai/useAiStream', () => ({
  useAiStream: (endpoint: string) => {
    const key = endpoint.includes('correct')
      ? 'correction'
      : endpoint.includes('reanalyze')
        ? 'reanalyze'
        : 'analyze';
    const state = mockStreamState[key];
    return {
      isStreaming: state.isStreaming,
      partialText: state.partialText,
      error: mockStreamError,
      stream: mockStream,
      cancel: mockCancel,
      retryCount: 0,
      result: null,
      clear: vi.fn(),
    };
  },
}));

/** Convenience: set the analyze stream as active with optional partial text. */
function setAnalyzeStreaming(partialText = '') {
  mockStreamState.analyze = { isStreaming: true, partialText };
}

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ activeLocationId: 'loc-1' }),
}));

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
    area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
    location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
  }),
}));

function makeState(groupOverrides: Partial<Group> = {}): BulkAddState {
  const p = createPhoto(new File([''], 'a.jpg', { type: 'image/jpeg' }));
  const g = { ...createGroupFromPhoto(p, null), ...groupOverrides };
  return { ...initialState, step: 'review', groups: [g], currentIndex: 0 };
}

function renderStep(state: BulkAddState, props: Partial<React.ComponentProps<typeof GroupReviewStep>> = {}) {
  return render(
    <ToastProvider>
      <GroupReviewStep
        groups={state.groups}
        currentIndex={state.currentIndex}
        editingFromSummary={state.editingFromSummary}
        aiSettings={null}
        dispatch={vi.fn()}
        {...props}
      />
    </ToastProvider>,
  );
}

describe('GroupReviewStep skeleton', () => {
  beforeEach(() => {
    mockStream.mockReset();
    mockStream.mockResolvedValue(null);
    mockCancel.mockReset();
    mockStreamError = null;
    mockStreamState = {
      analyze: { ...idleStream },
      reanalyze: { ...idleStream },
      correction: { ...idleStream },
    };
  });

  it('renders the group name input bound to group.name', () => {
    renderStep(makeState({ name: 'Holiday Stuff' }));
    const input = screen.getByLabelText(/^Name/) as HTMLInputElement;
    expect(input.value).toBe('Holiday Stuff');
  });

  it('typing in the name input dispatches UPDATE_GROUP', () => {
    const dispatch = vi.fn();
    renderStep(makeState(), { dispatch });
    const input = screen.getByLabelText(/^Name/);
    fireEvent.change(input, { target: { value: 'New name' } });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'UPDATE_GROUP',
      changes: expect.objectContaining({ name: 'New name' }),
    }));
  });

  it('renders Back and Next buttons', () => {
    renderStep(makeState());
    expect(screen.getByRole('button', { name: /back/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /next|review all/i })).toBeDefined();
  });
});

describe('GroupReviewStep AI flow', () => {
  beforeEach(() => {
    mockStream.mockReset();
    mockStream.mockResolvedValue(null);
    mockCancel.mockReset();
    mockStreamError = null;
    mockStreamState = {
      analyze: { ...idleStream },
      reanalyze: { ...idleStream },
      correction: { ...idleStream },
    };
  });

  it('auto-triggers analyze on entry to a pending group with aiSettings', async () => {
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    renderStep(makeState({ status: 'pending' }), { aiSettings });
    // Wait for the auto-analyze useEffect to fire
    await screen.findByRole('button', { name: /back/i });
    expect(mockStream).toHaveBeenCalled();
  });

  it('multi-photo group sends `photos` field repeatedly in FormData', async () => {
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    let state = initialState;
    const p1 = createPhoto(new File([''], 'a.jpg', { type: 'image/jpeg' }));
    const p2 = createPhoto(new File([''], 'b.jpg', { type: 'image/jpeg' }));
    const grp = createGroupFromPhoto(p1, null);
    state = { ...state, step: 'review', groups: [{ ...grp, photos: [p1, p2] }], currentIndex: 0 };
    renderStep(state, { aiSettings });
    await screen.findByRole('button', { name: /back/i });
    // The first call to mockStream should be the analyze call
    const formData = mockStream.mock.calls[0][0] as FormData;
    expect(formData.getAll('photos')).toHaveLength(2);
    expect(formData.has('photo')).toBe(false);
  });

  it('single-photo group sends `photo` field (singular) in FormData', async () => {
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    renderStep(makeState({ status: 'pending' }), { aiSettings });
    await screen.findByRole('button', { name: /back/i });
    const formData = mockStream.mock.calls[0][0] as FormData;
    expect(formData.getAll('photos')).toHaveLength(0);
    expect(formData.has('photo')).toBe(true);
  });

  it('surfaces a stream error via SET_ANALYZE_ERROR when group is stuck on analyzing', async () => {
    mockStreamError = 'AI response was cut short — try a shorter query or increase max tokens';
    const dispatch = vi.fn();
    renderStep(makeState({ status: 'analyzing' }), { dispatch });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SET_ANALYZE_ERROR',
          error: 'AI response was cut short — try a shorter query or increase max tokens',
        }),
      );
    });
  });
});

describe('GroupReviewStep streaming UI', () => {
  beforeEach(() => {
    mockStream.mockReset();
    mockStream.mockResolvedValue(null);
    mockCancel.mockReset();
    mockStreamError = null;
    mockStreamState = {
      analyze: { ...idleStream },
      reanalyze: { ...idleStream },
      correction: { ...idleStream },
    };
  });

  it('shows the streaming label "Scanning" while analyzing with no items yet', () => {
    setAnalyzeStreaming();
    renderStep(makeState({ status: 'analyzing' }));
    expect(screen.getByText(/^Scanning/)).toBeTruthy();
  });

  it('shows "Found 1 item" once one item has streamed', () => {
    setAnalyzeStreaming('{"name": "Box", "items": ["Hammer"');
    renderStep(makeState({ status: 'analyzing' }));
    expect(screen.getByText(/Found 1 item$/)).toBeTruthy();
  });

  it('shows "Found 4 items" once four items have streamed', () => {
    setAnalyzeStreaming('{"name": "Box", "items": ["A", "B", "C", "D"');
    renderStep(makeState({ status: 'analyzing' }));
    expect(screen.getByText(/Found 4 items$/)).toBeTruthy();
  });

  it('shows the Cancel button while streaming', () => {
    setAnalyzeStreaming();
    renderStep(makeState({ status: 'analyzing' }));
    expect(screen.getByRole('button', { name: /cancel scan/i })).toBeTruthy();
  });

  it('hides the Cancel button when not streaming', () => {
    renderStep(makeState({ status: 'reviewed', name: 'Box' }));
    expect(screen.queryByRole('button', { name: /cancel scan/i })).toBeNull();
  });

  it('clicking Cancel reverts group status to pending', () => {
    setAnalyzeStreaming();
    const dispatch = vi.fn();
    renderStep(makeState({ status: 'analyzing' }), { dispatch });
    fireEvent.click(screen.getByRole('button', { name: /cancel scan/i }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_GROUP',
        changes: expect.objectContaining({ status: 'pending' }),
      }),
    );
  });

  it('clicking Cancel calls the stream cancel hook', () => {
    setAnalyzeStreaming();
    renderStep(makeState({ status: 'analyzing' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel scan/i }));
    expect(mockCancel).toHaveBeenCalled();
  });

  it('mounts the HUD scan overlay while streaming', () => {
    setAnalyzeStreaming();
    const { container } = renderStep(makeState({ status: 'analyzing' }));
    expect(container.querySelector('[data-photo-scan-frame]')).toBeTruthy();
  });

  it('does not mount the HUD scan overlay when not streaming', () => {
    const { container } = renderStep(makeState({ status: 'reviewed', name: 'Box' }));
    expect(container.querySelector('[data-photo-scan-frame]')).toBeNull();
  });

  it('shows "Try AI again" when status is pending and AI is configured', () => {
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    renderStep(makeState({ status: 'pending' }), { aiSettings });
    expect(screen.getByRole('button', { name: /try ai again/i })).toBeTruthy();
  });

  it('does not show "Try AI again" while streaming', () => {
    setAnalyzeStreaming();
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    renderStep(makeState({ status: 'analyzing' }), { aiSettings });
    expect(screen.queryByRole('button', { name: /try ai again/i })).toBeNull();
  });

  it('does not show "Try AI again" when AI settings are missing', () => {
    renderStep(makeState({ status: 'pending' }), { aiSettings: null });
    expect(screen.queryByRole('button', { name: /try ai again/i })).toBeNull();
  });
});

describe('GroupReviewStep header', () => {
  beforeEach(() => {
    mockStream.mockReset();
    mockStream.mockResolvedValue(null);
    mockCancel.mockReset();
    mockStreamError = null;
    mockStreamState = {
      analyze: { ...idleStream },
      reanalyze: { ...idleStream },
      correction: { ...idleStream },
    };
  });

  it('shows "Analyzing your photo" for a single-photo single-bin group during analysis', () => {
    setAnalyzeStreaming();
    renderStep(makeState({ status: 'analyzing' }));
    expect(screen.getByRole('heading', { name: 'Analyzing your photo' })).toBeTruthy();
  });

  it('shows "Analyzing your photos" (plural) for a multi-photo single-bin group', () => {
    setAnalyzeStreaming();
    const p1 = createPhoto(new File([''], 'a.jpg', { type: 'image/jpeg' }));
    const p2 = createPhoto(new File([''], 'b.jpg', { type: 'image/jpeg' }));
    const grp = { ...createGroupFromPhoto(p1, null), photos: [p1, p2], status: 'analyzing' as const };
    const state: BulkAddState = { ...initialState, step: 'review', groups: [grp], currentIndex: 0 };
    renderStep(state);
    expect(screen.getByRole('heading', { name: 'Analyzing your photos' })).toBeTruthy();
  });

  it('shows "Analyzing bin 3" for the 3rd group of 5 during analysis', () => {
    setAnalyzeStreaming();
    const groups: Group[] = Array.from({ length: 5 }).map(() => {
      const p = createPhoto(new File([''], 'p.jpg', { type: 'image/jpeg' }));
      return createGroupFromPhoto(p, null);
    });
    groups[2] = { ...groups[2], status: 'analyzing' };
    const state: BulkAddState = { ...initialState, step: 'review', groups, currentIndex: 2 };
    renderStep(state);
    expect(screen.getByRole('heading', { name: 'Analyzing bin 3' })).toBeTruthy();
  });

  it('shows "Review bin" once analysis is done', () => {
    renderStep(makeState({ status: 'reviewed', name: 'Box' }));
    expect(screen.getByRole('heading', { name: 'Review bin' })).toBeTruthy();
  });

  it('shows "Tap any field to edit" subtitle once analysis is done', () => {
    renderStep(makeState({ status: 'reviewed', name: 'Box' }));
    expect(screen.getByText('Tap any field to edit')).toBeTruthy();
  });

  it('does not show the "Tap any field to edit" subtitle during analysis', () => {
    setAnalyzeStreaming();
    renderStep(makeState({ status: 'analyzing' }));
    expect(screen.queryByText('Tap any field to edit')).toBeNull();
  });

  it('renders QueueDots when there are 2+ groups', () => {
    const groups: Group[] = Array.from({ length: 3 }).map(() => {
      const p = createPhoto(new File([''], 'p.jpg', { type: 'image/jpeg' }));
      return createGroupFromPhoto(p, null);
    });
    const state: BulkAddState = { ...initialState, step: 'review', groups, currentIndex: 0 };
    const { container } = renderStep(state);
    const dots = container.querySelectorAll('[data-queue-dot]');
    expect(dots.length).toBe(3);
  });

  it('does not render QueueDots when there is only 1 group', () => {
    const { container } = renderStep(makeState());
    expect(container.querySelectorAll('[data-queue-dot]').length).toBe(0);
  });
});

describe('GroupReviewStep lock confirmation beat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStream.mockReset();
    mockCancel.mockReset();
    mockStreamError = null;
    mockStreamState = {
      analyze: { ...idleStream },
      reanalyze: { ...idleStream },
      correction: { ...idleStream },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not dispatch SET_ANALYZE_RESULT immediately when streamAnalyze resolves', async () => {
    mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    const dispatch = vi.fn();
    renderStep(makeState({ status: 'pending' }), { aiSettings, dispatch });

    // Let microtasks (auto-analyze useEffect, stream promise) settle, but do NOT advance timers.
    await vi.advanceTimersByTimeAsync(0);

    const resultDispatches = dispatch.mock.calls.filter(
      (call) => call[0]?.type === 'SET_ANALYZE_RESULT',
    );
    expect(resultDispatches).toHaveLength(0);
  });

  it('dispatches SET_ANALYZE_RESULT after the 300ms lock-confirmation timer expires', async () => {
    mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    const dispatch = vi.fn();
    renderStep(makeState({ status: 'pending' }), { aiSettings, dispatch });

    await vi.advanceTimersByTimeAsync(300);

    const resultDispatches = dispatch.mock.calls.filter(
      (call) => call[0]?.type === 'SET_ANALYZE_RESULT',
    );
    expect(resultDispatches).toHaveLength(1);
    expect(resultDispatches[0][0]).toMatchObject({
      type: 'SET_ANALYZE_RESULT',
      name: 'Holiday Decorations',
    });
  });

  it('renders PhotoScanFrame phase="locking" during the 300ms beat', async () => {
    mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    const { container } = renderStep(makeState({ status: 'pending' }), { aiSettings });

    // Flush microtasks so the async chain (buildPhotosFormData → streamAnalyze → setConfirmPhase)
    // completes and React re-renders before we advance fake timers into the beat window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Now advance to within the 300ms beat (stream resolved, timer not yet fired).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const brackets = container.querySelectorAll('[data-bracket]');
    expect(brackets.length).toBe(4);
    brackets.forEach((el) => {
      expect(el.getAttribute('data-phase')).toBe('locking');
    });
  });

  it('keeps the photo full-size (aspect-square, not max-h-20) during the lock beat', async () => {
    mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    const { container } = renderStep(makeState({ status: 'pending' }), { aiSettings });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const photo = container.querySelector('img');
    expect(photo).toBeTruthy();
    expect(photo!.className).toMatch(/aspect-square/);
    expect(photo!.className).not.toMatch(/max-h-20/);
  });

  it('hides the Cancel button during the lock beat', async () => {
    mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    renderStep(makeState({ status: 'pending' }), { aiSettings });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(screen.queryByRole('button', { name: /cancel scan/i })).toBeNull();
  });

  it('shows "LOCKED" in the status-row label during the lock beat', async () => {
    mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    renderStep(makeState({ status: 'pending' }), { aiSettings });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // "LOCKED" appears in the HUD readout (PhotoScanFrame) and in the status-row label.
    expect(screen.getAllByText('LOCKED').length).toBeGreaterThan(0);
  });

  it('skips the lock beat and dispatches immediately when prefers-reduced-motion is set', async () => {
    // Mock matchMedia to report reduced-motion preference.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
      const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
      const dispatch = vi.fn();
      const { container } = renderStep(makeState({ status: 'pending' }), { aiSettings, dispatch });

      // Let the stream resolve. NO timer advancement past the moment the stream resolves —
      // the dispatch must happen synchronously when reduced-motion is set.
      await vi.advanceTimersByTimeAsync(0);

      const resultDispatches = dispatch.mock.calls.filter(
        (call) => call[0]?.type === 'SET_ANALYZE_RESULT',
      );
      expect(resultDispatches).toHaveLength(1);

      // Phase="locking" must not have been rendered at any point.
      container.querySelectorAll('[data-bracket]').forEach((el) => {
        expect(el.getAttribute('data-phase')).not.toBe('locking');
      });
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('clears the lock timer on unmount (no orphaned setTimeout)', async () => {
    mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    const dispatch = vi.fn();
    const { unmount } = renderStep(makeState({ status: 'pending' }), { aiSettings, dispatch });

    // Trigger the stream to resolve and enter the lock phase.
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    // Sanity: dispatch hasn't been called with SET_ANALYZE_RESULT yet (still in lock window).
    const beforeUnmount = dispatch.mock.calls.filter((c) => c[0]?.type === 'SET_ANALYZE_RESULT');
    expect(beforeUnmount).toHaveLength(0);

    // Unmount before the 300ms expires.
    unmount();

    // Now advance well past 300ms — the deferred applyPendingResult must NOT fire.
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });

    const afterUnmount = dispatch.mock.calls.filter((c) => c[0]?.type === 'SET_ANALYZE_RESULT');
    expect(afterUnmount).toHaveLength(0);
  });

  it('commits the pending result when navigating Next during the lock beat', async () => {
    mockStream.mockResolvedValue({ name: 'Holiday Decorations', items: [{ name: 'String lights' }] });
    const aiSettings = { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null } as any;
    const dispatch = vi.fn();

    // Two-group state so Next isn't disabled.
    let state = initialState;
    const p1 = createPhoto(new File([''], 'a.jpg', { type: 'image/jpeg' }));
    const p2 = createPhoto(new File([''], 'b.jpg', { type: 'image/jpeg' }));
    const g1 = { ...createGroupFromPhoto(p1, null), status: 'pending' as const };
    const g2 = { ...createGroupFromPhoto(p2, null), status: 'pending' as const };
    state = { ...state, step: 'review', groups: [g1, g2], currentIndex: 0 };

    renderStep(state, { aiSettings, dispatch });

    // Enter the lock phase (stream resolved, timer running).
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    // User clicks Next mid-lock.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    });

    // The pending result must have been applied before navigation.
    const resultDispatches = dispatch.mock.calls.filter(
      (call) => call[0]?.type === 'SET_ANALYZE_RESULT',
    );
    expect(resultDispatches).toHaveLength(1);
  });
});
