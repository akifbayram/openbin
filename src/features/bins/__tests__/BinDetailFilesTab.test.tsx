import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BinDetailFilesTab } from '../BinDetailFilesTab';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({ results: [], count: 0 })) }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ user: { id: 'u1' }, token: 't' })) }));
vi.mock('@/lib/qrConfig', () => ({ isAttachmentsEnabled: () => true }));
vi.mock('@/lib/usePermissions', () => ({
  usePermissions: vi.fn(() => ({ isAdmin: true, canWrite: true })),
}));
vi.mock('@/features/photos/PhotoGallery', () => ({ PhotoGallery: () => <div data-testid="photo-gallery" /> }));
vi.mock('@/features/attachments/useAttachments', () => ({
  useAttachments: () => ({ attachments: [] }),
}));

const basePlanInfo = {
  plan: 'free' as const,
  status: 'active' as const,
  activeUntil: null,
  previousSubStatus: null,
  selfHosted: false,
  locked: false,
  upgradeUrl: 'https://upgrade.example/pro',
  upgradePlusUrl: null,
  upgradeProUrl: null,
  portalUrl: null,
  subscribePlanUrl: null,
  upgradeAction: null,
  upgradePlusAction: null,
  upgradeProAction: null,
  subscribePlanAction: null,
  portalAction: null,
  canDowngradeToFree: false,
  aiCredits: null,
  cancelAtPeriodEnd: null,
  billingPeriod: null,
  features: {
    ai: true, apiKeys: false, customFields: false, fullExport: false,
    reorganize: false, binSharing: false, attachments: false,
    maxBins: 10, maxLocations: 1, maxPhotoStorageMb: 0, maxMembersPerLocation: 1,
    activityRetentionDays: 7, aiCreditsPerMonth: 10, reorganizeMaxBins: 10,
  },
};

vi.mock('@/lib/usePlan', () => ({
  usePlan: vi.fn(),
}));

import { usePlan } from '@/lib/usePlan';

describe('BinDetailFilesTab', () => {
  it('hides upload affordance when attachments feature is gated and user can edit', () => {
    // In non-EE builds (test environment has __EE__=false) the UpgradePrompt
    // is stripped by the compile-time gate — we only assert that the upload
    // affordance is hidden when gated.
    vi.mocked(usePlan).mockReturnValue({
      planInfo: basePlanInfo,
      isLoading: false,
      isPro: false, isPlus: false, isFree: true, isSelfHosted: false, isLocked: false,
      isGated: (f) => f === 'attachments',
      refresh: vi.fn(), usage: null, overLimits: null,
      isOverAnyLimit: false, isLocationOverLimit: () => false, refreshUsage: vi.fn(),
    });

    render(<BinDetailFilesTab binId="bin1" photos={[]} canEdit />);

    expect(screen.queryByRole('button', { name: /add attachment/i })).toBeNull();
  });

  it('renders upload affordance when feature is not gated', () => {
    vi.mocked(usePlan).mockReturnValue({
      planInfo: { ...basePlanInfo, plan: 'pro', features: { ...basePlanInfo.features, attachments: true } },
      isLoading: false,
      isPro: true, isPlus: false, isFree: false, isSelfHosted: false, isLocked: false,
      isGated: () => false,
      refresh: vi.fn(), usage: null, overLimits: null,
      isOverAnyLimit: false, isLocationOverLimit: () => false, refreshUsage: vi.fn(),
    });

    render(<BinDetailFilesTab binId="bin1" photos={[]} canEdit />);

    expect(screen.queryByText(/upgrade to pro/i)).toBeNull();
    expect(screen.getByRole('button', { name: /add attachment/i })).toBeInTheDocument();
  });
});
