import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
let mockStreamError: string | null = null;
vi.mock('@/features/ai/useAiStream', () => ({
  useAiStream: () => ({
    isStreaming: false,
    error: mockStreamError,
    stream: mockStream,
    cancel: vi.fn(),
  }),
}));

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
    mockStreamError = null;
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
    mockStreamError = null;
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
