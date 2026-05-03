import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const { addBinMock } = vi.hoisted(() => ({
  addBinMock: vi.fn(async () => ({ id: 'new-bin-id', name: 'Garage box' })),
}));

vi.mock('@/features/bins/useBins', () => ({
  addBin: addBinMock,
  notifyBinsChanged: vi.fn(),
  useAllTags: () => [],
}));

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', displayName: 'U', email: 'u@x', avatarUrl: null, createdAt: '', updatedAt: '' },
    activeLocationId: 'loc-1',
  }),
}));
vi.mock('@/features/locations/useLocations', () => ({
  useActiveLocation: () => ({ id: 'loc-1', name: 'Home', term_bin: 'bin', term_area: 'area', term_location: 'location' }),
  useLocationList: () => ({ locations: [{ id: 'loc-1', name: 'Home', term_bin: 'bin', term_area: 'area', term_location: 'location' }], isLoading: false }),
}));
vi.mock('../usePhotoAnalysis', () => ({
  usePhotoAnalysis: () => ({
    fileInputRef: { current: null }, photos: [], photoPreviews: [], analyzing: false,
    analyzeError: null, analyzeMode: 'idle', analyzePartialText: '',
    cancelAnalyze: vi.fn(), handlePhotoSelect: vi.fn(), handleRemovePhoto: vi.fn(),
    addPhotosFromFiles: vi.fn(), handleAnalyze: vi.fn(), handleReanalyze: vi.fn(),
  }),
}));

vi.mock('@/features/areas/AreaPicker', () => ({ AreaPicker: () => null }));
vi.mock('@/features/areas/useAreas', () => ({ useAreaList: () => ({ areas: [], isLoading: false }) }));
vi.mock('@/features/capture/capturedPhotos', () => ({ setCapturedReturnTarget: vi.fn() }));
vi.mock('@/features/capture/useAutoOpenOnCapture', () => ({ useReopenCreateOnCapture: vi.fn() }));
vi.mock('../useCustomFields', () => ({
  useCustomFields: () => ({ fields: [], isLoading: false }),
}));
vi.mock('@/features/ai/useAiSettings', () => ({ useAiSettings: () => ({ settings: null, isLoading: false }) }));
vi.mock('@/features/ai/useAiProviderSetup', () => ({ useAiProviderSetup: () => ({ configured: false, setup: null }) }));
vi.mock('@/lib/aiToggle', () => ({ useAiEnabled: () => false }));
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
vi.mock('../useAiFillState', () => ({
  useAiFillState: () => ({
    filled: new Set(),
    snapshot: vi.fn(),
    markFilled: vi.fn(),
    undo: vi.fn(() => null),
    reset: vi.fn(),
    keyFor: (field: string) => field,
    styleFor: () => undefined,
  }),
}));
vi.mock('../useItemEntry', () => ({
  useItemEntry: () => ({
    quickAdd: {
      value: '',
      setValue: vi.fn(),
      saving: false,
      state: 'idle',
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
    },
    dictation: undefined,
    canTranscribe: false,
  }),
}));

import { NewBinPage } from '../NewBinPage';

afterEach(() => {
  navigateMock.mockReset();
  addBinMock.mockClear();
});

describe('NewBinPage submit', () => {
  it('navigates to /bin/:id after a single-bin submit', async () => {
    render(
      <MemoryRouter initialEntries={['/new-bin']}>
        <Routes><Route path="/new-bin" element={<NewBinPage />} /></Routes>
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Garage box' } });
    const submit = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submit);

    await waitFor(() => expect(addBinMock).toHaveBeenCalledTimes(1));
    expect(addBinMock).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: 'loc-1', name: 'Garage box' }),
    );
    expect(navigateMock).toHaveBeenCalledWith('/bin/new-bin-id');
  });
});
