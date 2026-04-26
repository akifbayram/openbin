import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddPhotosFromFiles = vi.fn();

vi.mock('../usePhotoAnalysis', () => ({
  usePhotoAnalysis: () => ({
    fileInputRef: { current: null },
    photos: [] as File[],
    photoPreviews: [] as string[],
    analyzing: false,
    analyzeError: null,
    analyzeMode: 'idle' as const,
    analyzePartialText: '',
    cancelAnalyze: vi.fn(),
    handlePhotoSelect: vi.fn(),
    handleRemovePhoto: vi.fn(),
    addPhotosFromFiles: mockAddPhotosFromFiles,
    handleAnalyze: vi.fn(),
    handleReanalyze: vi.fn(),
  }),
}));

vi.mock('@/features/ai/useAiSettings', () => ({
  useAiSettings: () => ({ settings: null, isLoading: false }),
}));

vi.mock('@/features/ai/useAiProviderSetup', () => ({
  useAiProviderSetup: () => ({ configured: false }),
}));

vi.mock('@/lib/aiToggle', () => ({
  useAiEnabled: () => ({ aiEnabled: false }),
}));

vi.mock('@/features/areas/useAreas', () => ({
  useAreaList: () => ({ areas: [] }),
  buildAreaTree: () => [],
  flattenAreaTree: () => [],
  getAreaPath: () => '',
  notifyAreasChanged: () => {},
}));

vi.mock('../useCustomFields', () => ({
  useCustomFields: () => ({ fields: [] }),
}));

vi.mock('../useQuickAdd', () => ({
  useQuickAdd: () => ({
    value: '',
    setValue: vi.fn(),
    saving: false,
    state: 'input',
    expandedText: '',
    setExpandedText: vi.fn(),
    checked: new Map(),
    structuredItems: null,
    isStructuring: false,
    structureError: null,
    selectedCount: 0,
    handleAdd: vi.fn(),
    handlePaste: vi.fn(),
    handleAiClick: vi.fn(),
    handleExpandedKeyDown: vi.fn(),
    handleExtractClick: vi.fn(),
    toggleChecked: vi.fn(),
    handleConfirmAdd: vi.fn(),
    backToExpanded: vi.fn(),
    cancelExpanded: vi.fn(),
  }),
}));

vi.mock('@/lib/useDictation', () => ({
  useDictation: () => ({
    state: 'idle',
    transcript: '',
    error: null,
    duration: 0,
    structuredItems: null,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    confirm: vi.fn(),
    editTranscript: vi.fn(),
    submitEditedTranscript: vi.fn(),
  }),
}));

vi.mock('@/lib/audioRecorder', () => ({
  isRecordingSupported: () => false,
}));

vi.mock('@/features/bins/PhotoBulkAdd', () => ({
  PhotoBulkAdd: () => <div data-testid="photo-bulk-add">wizard</div>,
}));

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
    location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
    area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
  }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    activeLocationId: 'loc-1',
    demoMode: false,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    setActiveLocationId: vi.fn(),
    updateUser: vi.fn(),
    deleteAccount: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// If additional mocks are required due to import graph (e.g., InlineAiSetup pulls more),
// add them here — minimum surface only. The goal is to render the form's mount effect.

import { BinCreateForm } from '../BinCreateForm';

function renderForm(props: Partial<React.ComponentProps<typeof BinCreateForm>> = {}) {
  const onSubmit = vi.fn();
  const defaults: React.ComponentProps<typeof BinCreateForm> = {
    mode: 'full',
    locationId: 'loc-1',
    onSubmit,
    ...props,
  };
  return render(
    <MemoryRouter>
      <BinCreateForm {...defaults} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockAddPhotosFromFiles.mockClear();
});

describe('BinCreateForm initialPhotos seeding', () => {
  it('seeds photos once when mounted with initialPhotos', () => {
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ];
    const onInitialPhotosConsumed = vi.fn();

    renderForm({ initialPhotos: files, onInitialPhotosConsumed });

    expect(mockAddPhotosFromFiles).toHaveBeenCalledTimes(1);
    expect(mockAddPhotosFromFiles).toHaveBeenCalledWith(files);
    expect(onInitialPhotosConsumed).toHaveBeenCalledTimes(1);
  });

  it('does not re-seed when re-rendered with a fresh onInitialPhotosConsumed reference', () => {
    // A new inline callback reference each render changes the effect's dep array
    // and would re-fire without the ref guard. This test exercises that guard.
    const files = [new File(['a'], 'a.jpg', { type: 'image/jpeg' })];
    const consumed1 = vi.fn();
    const { rerender } = renderForm({ initialPhotos: files, onInitialPhotosConsumed: consumed1 });

    const consumed2 = vi.fn();
    act(() => {
      rerender(
        <MemoryRouter>
          <BinCreateForm
            mode="full"
            locationId="loc-1"
            onSubmit={vi.fn()}
            initialPhotos={files}
            onInitialPhotosConsumed={consumed2}
          />
        </MemoryRouter>,
      );
    });

    expect(mockAddPhotosFromFiles).toHaveBeenCalledTimes(1);
    expect(consumed1).toHaveBeenCalledTimes(1);
    expect(consumed2).not.toHaveBeenCalled();
  });

  it('does nothing when initialPhotos is null', () => {
    const onInitialPhotosConsumed = vi.fn();
    renderForm({ initialPhotos: null, onInitialPhotosConsumed });
    expect(mockAddPhotosFromFiles).not.toHaveBeenCalled();
    expect(onInitialPhotosConsumed).not.toHaveBeenCalled();
  });

  it('does nothing when initialPhotos is an empty array', () => {
    const onInitialPhotosConsumed = vi.fn();
    renderForm({ initialPhotos: [], onInitialPhotosConsumed });
    expect(mockAddPhotosFromFiles).not.toHaveBeenCalled();
    expect(onInitialPhotosConsumed).not.toHaveBeenCalled();
  });
});

describe('BinCreateForm wizard mode', () => {
  it('renders single-bin form when initialGroups is null', () => {
    const { getByLabelText, queryByTestId } = renderForm({ initialGroups: null, initialPhotos: null });
    expect(getByLabelText(/name/i)).toBeInTheDocument();
    expect(queryByTestId('photo-bulk-add')).not.toBeInTheDocument();
  });

  it('renders single-bin form when all photos belong to one group', () => {
    const files = [new File(['a'], 'a.jpg', { type: 'image/jpeg' })];
    const { getByLabelText, queryByTestId } = renderForm({ initialPhotos: files, initialGroups: [0] });
    expect(getByLabelText(/name/i)).toBeInTheDocument();
    expect(queryByTestId('photo-bulk-add')).not.toBeInTheDocument();
  });

  it('renders PhotoBulkAdd when initialGroups has more than one distinct id', () => {
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ];
    const { queryByLabelText, getByTestId } = renderForm({ initialPhotos: files, initialGroups: [0, 1] });
    expect(queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(getByTestId('photo-bulk-add')).toBeInTheDocument();
  });

  it('switches to wizard mode when 2 files are selected via file input', async () => {
    const { container } = renderForm();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ];
    Object.defineProperty(input, 'files', { value: files });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByTestId('photo-bulk-add')).toBeInTheDocument());
  });
});
