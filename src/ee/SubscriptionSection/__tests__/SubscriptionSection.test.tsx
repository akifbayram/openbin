import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionSection } from '../../SubscriptionSection';
import { FIXTURE_CATALOG } from './fixtures/planCatalog';
import { EMPTY_USAGE, makePlanInfo } from './fixtures/planInfo';

vi.mock('@/lib/usePlan', () => ({
  usePlan: vi.fn(),
  getLockedMessage: (prev: 'trial' | 'active' | null) => {
    if (prev === 'trial') return 'Your trial has ended. Subscribe to continue using OpenBin.';
    if (prev === 'active') return 'Your subscription has expired. Resubscribe to continue using OpenBin.';
    return 'Your plan is inactive. Subscribe to continue using OpenBin.';
  },
  getLockedCta: (prev: 'trial' | 'active' | null) => (prev === 'trial' ? 'Subscribe' : 'Resubscribe'),
}));
vi.mock('../hooks/usePlanCatalog', () => ({
  usePlanCatalog: vi.fn(() => ({ plans: FIXTURE_CATALOG.plans, isLoading: false, error: null })),
}));

import { usePlan } from '@/lib/usePlan';

function setPlan(planInfo: ReturnType<typeof makePlanInfo>, usage = EMPTY_USAGE) {
  vi.mocked(usePlan).mockReturnValue({
    planInfo,
    usage,
    isLoading: false,
    isPro: planInfo.plan === 'pro',
    isPlus: planInfo.plan === 'plus',
    isFree: planInfo.plan === 'free',
    isSelfHosted: planInfo.selfHosted,
    isLocked: planInfo.locked,
    isGated: () => false,
    refresh: vi.fn(),
    overLimits: null,
    isOverAnyLimit: false,
    isLocationOverLimit: () => false,
    refreshUsage: vi.fn(),
  } as ReturnType<typeof usePlan>);
}

describe('SubscriptionSection orchestrator', () => {
  it('Free state: shows plan picker, no manage button', () => {
    setPlan(makePlanInfo({ plan: 'free' }));
    render(<SubscriptionSection />);
    expect(screen.getByText('Free Plan')).toBeInTheDocument();
    expect(screen.getByText('Plus')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Manage Subscription/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Manage Subscription/i })).toBeNull();
  });

  it('Plus paid monthly: shows upsell banner + Pro upgrade card + manage', () => {
    setPlan(makePlanInfo({
      plan: 'plus',
      status: 'active',
      activeUntil: '2026-05-27T00:00:00Z',
      billingPeriod: 'monthly',
      portalAction: { url: 'https://billing.openbin.app/portal', method: 'POST', fields: { token: 't' } },
      upgradeProAction: { url: 'https://billing.openbin.app/upgrade', method: 'POST', fields: { token: 't' } },
    }));
    render(<SubscriptionSection />);
    expect(screen.getByText(/Save .* by switching to annual/i)).toBeInTheDocument();
    expect(screen.getByText(/Get Pro/i)).toBeInTheDocument();
    expect(screen.getByText(/Manage Subscription/i)).toBeInTheDocument();
  });

  it('Pro cancel-pending: shows Reactivate label instead of Manage', () => {
    setPlan(makePlanInfo({
      plan: 'pro',
      status: 'active',
      activeUntil: '2026-05-27T00:00:00Z',
      cancelAtPeriodEnd: '2026-05-27T00:00:00Z',
      portalAction: { url: 'https://billing.openbin.app/portal', method: 'POST', fields: { token: 't' } },
    }));
    render(<SubscriptionSection />);
    expect(screen.getByText(/Reactivate/i)).toBeInTheDocument();
    expect(screen.queryByText(/Manage Subscription/i)).toBeNull();
  });

  it('locked: shows resubscribe banner only', () => {
    setPlan(makePlanInfo({
      plan: 'plus',
      status: 'inactive',
      locked: true,
      previousSubStatus: 'active',
      subscribePlanAction: { url: 'https://billing.openbin.app/sub', method: 'POST', fields: { token: 't' } },
    }));
    render(<SubscriptionSection />);
    expect(screen.getAllByText(/Resubscribe/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Plus.*Active/i)).toBeNull();
  });

  it('locked from trial: shows trial-ended message + Subscribe CTA', () => {
    setPlan(makePlanInfo({
      plan: 'plus',
      status: 'inactive',
      locked: true,
      previousSubStatus: 'trial',
      subscribePlanAction: { url: 'https://billing.openbin.app/sub', method: 'POST', fields: { token: 't' } },
    }));
    render(<SubscriptionSection />);
    expect(screen.getByText(/trial has ended/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Subscribe/i).length).toBeGreaterThan(0);
  });
});
