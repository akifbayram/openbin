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
  ai: true, apiKeys: false, customFields: false, fullExport: true,
  reorganize: true, binSharing: false, attachments: false, maxBins: 100, maxLocations: 1,
  maxPhotoStorageMb: 100, maxMembersPerLocation: 1, activityRetentionDays: 30,
  aiCreditsPerMonth: 25, reorganizeMaxBins: 10,
};

const BASE_USAGE: PlanUsage = {
  binCount: 10,
  locationCount: 1,
  photoStorageMb: 5,
  memberCounts: {},
  overLimits: { locations: false, photos: false, members: [] },
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
    upgradeAction: null,
    upgradePlusAction: null,
    upgradeProAction: null,
    subscribePlanAction: null,
    portalAction: null,
    canDowngradeToFree: false,
    aiCredits: null,
    ...overrides,
  };
}

function setupMock(planInfo: PlanInfo, opts?: { isLocked?: boolean; usage?: PlanUsage | null }) {
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
    usage: opts?.usage !== undefined ? opts.usage : null,
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
    // After the 2026-04-26 hardening pass the SubscriptionSection consumes
    // the structured *Action fields. /plans (the plan picker for free
    // users) is GET-shaped because it's a static page, so CheckoutLink
    // renders an <a href="..."> here — the legacy assertion still applies.
    setupMock(makePlanInfo({
      plan: 'free',
      status: 'inactive',
      portalUrl: 'https://billing.example.com/portal',
      portalAction: { url: 'https://billing.example.com/portal', method: 'POST', fields: {} },
      upgradeUrl: 'https://billing.example.com/upgrade',
      upgradeAction: { url: 'https://billing.example.com/upgrade', method: 'GET', fields: {} },
      upgradePlusUrl: 'https://billing.example.com/plus',
      upgradePlusAction: { url: 'https://billing.example.com/plus', method: 'POST', fields: {} },
      upgradeProUrl: 'https://billing.example.com/pro',
      upgradeProAction: { url: 'https://billing.example.com/pro', method: 'POST', fields: {} },
    }));

    renderSection();

    expect(screen.queryByText('Manage Subscription')).toBeNull();
    const upgradeLink = screen.getByText('Upgrade');
    expect(upgradeLink).toBeDefined();
    expect(upgradeLink.closest('a')?.getAttribute('href')).toBe('https://billing.example.com/upgrade');
    expect(screen.queryByText('Upgrade to Plus')).toBeNull();
    expect(screen.queryByText('Upgrade to Pro')).toBeNull();
  });

  // Task 2: Plan header badge tests
  it('shows Trial badge for trial users', () => {
    setupMock(makePlanInfo({
      status: 'trial',
      activeUntil: '2027-01-01T00:00:00.000Z',
      subscribePlanUrl: 'https://billing.example.com/checkout',
    }));
    renderSection();
    expect(screen.getByText('Trial')).toBeDefined();
    expect(screen.getByText(/Plus Plan/)).toBeDefined();
  });

  it('shows Active badge for active subscribers', () => {
    setupMock(makePlanInfo({
      status: 'active',
      portalUrl: 'https://billing.example.com/portal',
    }));
    renderSection();
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText(/Plus Plan/)).toBeDefined();
  });

  // Task 3: Locked banner tests
  it('shows locked warning banner when subscription is locked', () => {
    setupMock(makePlanInfo({
      status: 'inactive',
      locked: true,
      previousSubStatus: 'active',
      upgradeUrl: 'https://billing.example.com/upgrade',
      canDowngradeToFree: true,
    }), { isLocked: true });
    renderSection();
    expect(screen.getByText('Your subscription has expired. Resubscribe to continue using OpenBin.')).toBeDefined();
  });

  it('does not show locked warning banner for active subscribers', () => {
    setupMock(makePlanInfo({
      status: 'active',
      portalUrl: 'https://billing.example.com/portal',
    }));
    renderSection();
    expect(screen.queryByText(/expired|ended|inactive/i)).toBeNull();
  });

  // Task 4: Usage warning tests
  it('hides usage warnings when all metrics are under limits', () => {
    setupMock(
      makePlanInfo({ status: 'active', portalUrl: 'https://billing.example.com/portal' }),
      { usage: { ...BASE_USAGE, binCount: 10 } },
    );
    renderSection();
    expect(screen.queryByText('Usage')).toBeNull();
    expect(screen.queryByText(/Over limit/)).toBeNull();
  });

  it('shows usage warning when bins exceed limit', () => {
    setupMock(
      makePlanInfo({
        status: 'active',
        portalUrl: 'https://billing.example.com/portal',
        features: { ...BASE_FEATURES, maxBins: 100 },
      }),
      { usage: { ...BASE_USAGE, binCount: 120 } },
    );
    renderSection();
    expect(screen.getByText('Usage')).toBeDefined();
    expect(screen.getByText(/Over limit/)).toBeDefined();
  });

  // Task 5: Unlock section tests
  it('shows "Unlock with Plus" section for free users', () => {
    setupMock(makePlanInfo({
      plan: 'free',
      status: 'inactive',
      upgradeUrl: 'https://billing.example.com/upgrade',
      upgradePlusUrl: 'https://billing.example.com/plus',
      features: {
        ...BASE_FEATURES,
        ai: true,
        customFields: false,
        fullExport: false,
        reorganize: false,
        maxBins: 10,
        maxLocations: 1,
        maxPhotoStorageMb: 0,
        maxMembersPerLocation: 1,
        aiCreditsPerMonth: 10,
      },
    }));
    renderSection();
    expect(screen.getByText('Unlock with Plus')).toBeDefined();
    expect(screen.getByText('AI reorganization')).toBeDefined();
  });

  it('shows "Unlock with Pro" section for active Plus users', () => {
    setupMock(makePlanInfo({
      status: 'active',
      portalUrl: 'https://billing.example.com/portal',
      upgradeProUrl: 'https://billing.example.com/pro',
      features: {
        ...BASE_FEATURES,
      },
    }));
    renderSection();
    expect(screen.getByText('Unlock with Pro')).toBeDefined();
    expect(screen.getByText('API keys')).toBeDefined();
  });

  it('does not show unlock section for active Pro users', () => {
    setupMock(makePlanInfo({
      plan: 'pro',
      status: 'active',
      portalUrl: 'https://billing.example.com/portal',
      features: {
        ...BASE_FEATURES,
        apiKeys: true,
        reorganize: true,
        binSharing: true,
        maxBins: null,
        maxLocations: null,
        maxPhotoStorageMb: null,
        maxMembersPerLocation: null,
      },
    }));
    renderSection();
    expect(screen.queryByText(/Unlock with/)).toBeNull();
  });
});
