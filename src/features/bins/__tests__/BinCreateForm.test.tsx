import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddPhotosFromFiles = vi.fn();

interface PhotoAnalysisOverrides {
  photos?: File[];
  analyzing?: boolean;
  analyzeError?: string | null;
}

let photoAnalysisOverrides: PhotoAnalysisOverrides = {};

function setPhotoAnalysisState(overrides: PhotoAnalysisOverrides) {
  photoAnalysisOverrides = overrides;
}

vi.mock('../usePhotoAnalysis', () => ({
  usePhotoAnalysis: () => {
    const photos = photoAnalysisOverrides.photos ?? [];
    return {
      fileInputRef: { current: null },
      photos,
      photoPreviews: photos.map((_, i) => `preview-${i}`),
      analyzing: photoAnalysisOverrides.analyzing ?? false,
      analyzeError: photoAnalysisOverrides.analyzeError ?? null,
      analyzeMode: 'idle' as const,
      analyzePartialText: '',
      cancelAnalyze: vi.fn(),
      handlePhotoSelect: vi.fn(),
      handleRemovePhoto: vi.fn(),
      addPhotosFromFiles: mockAddPhotosFromFiles,
      handleAnalyze: vi.fn(),
      handleReanalyze: vi.fn(),
    };
  },
}));

const mockSetCapturedPhotos = vi.fn();
const mockSetCapturedReturnTarget = vi.fn();

vi.mock('@/features/capture/capturedPhotos', () => ({
  setCapturedPhotos: (...args: unknown[]) => mockSetCapturedPhotos(...args),
  setCapturedReturnTarget: (...args: unknown[]) => mockSetCapturedReturnTarget(...args),
}));

const mockOpenCommandInput = vi.fn();

vi.mock('@/features/tour/TourProvider', () => ({
  getCommandInputRef: () => ({ current: { open: mockOpenCommandInput, close: vi.fn() } }),
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

vi.mock('@/lib/usePlan', () => ({
  usePlan: () => ({
    planInfo: {
      plan: 'pro', status: 'active', activeUntil: null, previousSubStatus: null,
      selfHosted: true, locked: false, features: {},
      upgradeUrl: null, upgradePlusUrl: null, upgradeProUrl: null, portalUrl: null, subscribePlanUrl: null,
      upgradeAction: null, upgradePlusAction: null, upgradeProAction: null, subscribePlanAction: null, portalAction: null,
      canDowngradeToFree: false, aiCredits: null, cancelAtPeriodEnd: null, billingPeriod: null, trialPeriodDays: 7,
    },
    isLoading: false,
    isPro: false, isPlus: false, isFree: false, isSelfHosted: true, isLocked: false,
    isGated: () => false,
    refresh: vi.fn(), usage: null, overLimits: null, isOverAnyLimit: false,
    isLocationOverLimit: () => false, refreshUsage: vi.fn(),
  }),
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
    recoverAccount: vi.fn(),
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
  mockSetCapturedPhotos.mockClear();
  mockSetCapturedReturnTarget.mockClear();
  mockOpenCommandInput.mockClear();
  setPhotoAnalysisState({});
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

function makeFiles(n: number): File[] {
  return Array.from({ length: n }, (_, i) =>
    new File([String(i)], `p${i}.jpg`, { type: 'image/jpeg' }),
  );
}

describe('BinCreateForm bulk-add hint', () => {
  it('does not appear with a single photo', () => {
    setPhotoAnalysisState({ photos: makeFiles(1) });
    renderForm();
    expect(screen.queryByRole('button', { name: /use bulk add/i })).toBeNull();
  });

  it('appears in full mode when 2+ photos are staged', () => {
    setPhotoAnalysisState({ photos: makeFiles(2) });
    renderForm();
    expect(screen.getByRole('button', { name: /use bulk add/i })).toBeTruthy();
  });

  it('does not appear in onboarding mode', () => {
    setPhotoAnalysisState({ photos: makeFiles(3) });
    renderForm({ mode: 'onboarding' });
    expect(screen.queryByRole('button', { name: /use bulk add/i })).toBeNull();
  });

  it('hides while AI analysis is running', () => {
    setPhotoAnalysisState({ photos: makeFiles(3), analyzing: true });
    renderForm();
    expect(screen.queryByRole('button', { name: /use bulk add/i })).toBeNull();
  });

  it('disappears after the user dismisses it', () => {
    setPhotoAnalysisState({ photos: makeFiles(3) });
    renderForm();
    expect(screen.getByRole('button', { name: /use bulk add/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /dismiss bulk add hint/i }));
    expect(screen.queryByRole('button', { name: /use bulk add/i })).toBeNull();
  });

  it('stages photos and opens the command palette when the user switches', () => {
    const photos = makeFiles(3);
    setPhotoAnalysisState({ photos });
    const onCancel = vi.fn();
    renderForm({ showCancel: true, onCancel });

    fireEvent.click(screen.getByRole('button', { name: /use bulk add/i }));

    expect(mockSetCapturedPhotos).toHaveBeenCalledWith(photos);
    expect(mockSetCapturedReturnTarget).toHaveBeenCalledWith('bulk-add');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockOpenCommandInput).toHaveBeenCalledTimes(1);
  });
});
