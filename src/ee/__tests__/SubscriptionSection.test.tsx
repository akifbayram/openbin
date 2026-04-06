import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanInfo, PlanUsage } from '@/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

const mockRefresh = vi.fn().mockResolvedValue(null);
const mockRefreshUsage = vi.fn().mockResolvedValue(undefined);

const mockUsePlan = vi.fn();

vi.mock('@/lib/usePlan', () => ({
  usePlan: () => mockUsePlan(),
  getLockedMessage: (prev: string | null) => {
    if (prev === 'trial') return 'Your trial has ended. Subscribe to continue using OpenBin.';
    if (prev === 'active') return 'Your subscription has expired. Resubscribe to continue using OpenBin.';
    return 'Your plan is inactive. Subscribe to continue using OpenBin.';
  },
  getLockedCta: (prev: string | null) => prev === 'trial' ? 'Subscribe' : 'Resubscribe',
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { SubscriptionSection } from '../SubscriptionSection';

const BASE_FEATURES = {
  ai: true, apiKeys: false, customFields: true, fullExport: true,
  reorganize: false, binSharing: false, maxBins: 500, maxLocations: 1,
  maxPhotoStorageMb: 100, maxMembersPerLocation: 1, activityRetentionDays: 30,
  aiCreditsPerMonth: 25,
};

function makePlanInfo(overrides: Partial<PlanInfo>): PlanInfo {
  return {
    plan: 'plus',
    status: 'active',
    activeUntil: null,
    previousSubStatus: null,
    selfHosted: false,
    locked: false,
    features: BASE_FEATURES,
    upgradeUrl: null,
    upgradePlusUrl: null,
    upgradeProUrl: null,
    portalUrl: null,
    subscribePlanUrl: null,
    canDowngradeToFree: false,
    aiCredits: null,
    ...overrides,
  };
}

function setupMock(planInfo: PlanInfo, opts?: { isLocked?: boolean }) {
  mockUsePlan.mockReturnValue({
    planInfo,
    isPro: planInfo.plan === 'pro',
    isPlus: planInfo.plan === 'plus',
    isFree: planInfo.plan === 'free',
    isSelfHosted: planInfo.selfHosted,
    isLocked: opts?.isLocked ?? planInfo.locked,
    isLoading: false,
    isGated: () => false,
    refresh: mockRefresh,
    usage: null as PlanUsage | null,
    overLimits: null,
    isOverAnyLimit: false,
    isLocationOverLimit: () => false,
    refreshUsage: mockRefreshUsage,
  });
}

function renderSection() {
  return render(
    <MemoryRouter>
      <SubscriptionSection />
    </MemoryRouter>,
  );
}

describe('SubscriptionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Switch to Free Plan" button for trial user with canDowngradeToFree=true', () => {
    setupMock(makePlanInfo({
      status: 'trial',
      activeUntil: '2027-01-01T00:00:00.000Z',
      subscribePlanUrl: 'https://billing.example.com/checkout',
      upgradeProUrl: 'https://billing.example.com/pro',
      canDowngradeToFree: true,
    }));

    renderSection();

    expect(screen.getByText('Switch to Free Plan')).toBeDefined();
  });

  it('shows "Continue with Free Plan" button for locked post-trial user with canDowngradeToFree=true', () => {
    setupMock(makePlanInfo({
      status: 'inactive',
      locked: true,
      previousSubStatus: 'trial',
      upgradeUrl: 'https://billing.example.com/upgrade',
      canDowngradeToFree: true,
    }), { isLocked: true });

    renderSection();

    expect(screen.getByText('Continue with Free Plan')).toBeDefined();
  });

  it('does not show downgrade button when canDowngradeToFree=false', () => {
    setupMock(makePlanInfo({
      status: 'active',
      portalUrl: 'https://billing.example.com/portal',
      upgradeProUrl: 'https://billing.example.com/pro',
      canDowngradeToFree: false,
    }));

    renderSection();

    expect(screen.queryByText('Switch to Free Plan')).toBeNull();
    expect(screen.queryByText('Continue with Free Plan')).toBeNull();
  });

  it('shows single "Upgrade" button for free plan users instead of "Manage Subscription"', () => {
    setupMock(makePlanInfo({
      plan: 'free',
      status: 'inactive',
      portalUrl: 'https://billing.example.com/portal',
      upgradeUrl: 'https://billing.example.com/upgrade',
      upgradePlusUrl: 'https://billing.example.com/plus',
      upgradeProUrl: 'https://billing.example.com/pro',
    }));

    renderSection();

    expect(screen.queryByText('Manage Subscription')).toBeNull();
    const upgradeLink = screen.getByText('Upgrade');
    expect(upgradeLink).toBeDefined();
    expect(upgradeLink.closest('a')?.getAttribute('href')).toBe('https://billing.example.com/upgrade');
    expect(screen.queryByText('Upgrade to Plus')).toBeNull();
    expect(screen.queryByText('Upgrade to Pro')).toBeNull();
  });
});
