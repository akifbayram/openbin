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
  getLockedCta: (prev: 'trial' | 'active' | null) =>
    prev === 'trial' ? 'Subscribe' : 'Resubscribe',
}));
vi.mock('../hooks/usePlanCatalog', () => ({
  usePlanCatalog: vi.fn(() => ({
    plans: FIXTURE_CATALOG.plans,
    isLoading: false,
    error: null,
  })),
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
    expect(screen.getByText('Plus')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Manage Subscription/i })).toBeNull();
  });

  it('Pro active monthly: renders new plan card with PRO eyebrow + Active + Renews + price', () => {
    setPlan(
      makePlanInfo({
        plan: 'pro',
        status: 'active',
        activeUntil: '2026-05-27T00:00:00Z',
        billingPeriod: 'monthly',
        portalAction: { url: 'https://billing.openbin.app/portal', method: 'POST', fields: { token: 't' } },
      }),
    );
    render(<SubscriptionSection />);
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/Renews May 27, 2026/)).toBeInTheDocument();
  });

  it('Pro active monthly: shows "Switch to annual" primary CTA + ghost Manage', () => {
    setPlan(
      makePlanInfo({
        plan: 'pro',
        status: 'active',
        activeUntil: '2026-05-27T00:00:00Z',
        billingPeriod: 'monthly',
        portalAction: { url: 'https://billing.openbin.app/portal', method: 'POST', fields: { token: 't' } },
      }),
    );
    render(<SubscriptionSection />);
    expect(screen.getByText(/Switch to annual — save/)).toBeInTheDocument();
    expect(screen.getByText(/Manage Subscription/i)).toBeInTheDocument();
  });

  it('Pro active annual: shows Saving line + ghost Manage + no primary annual CTA', () => {
    setPlan(
      makePlanInfo({
        plan: 'pro',
        status: 'active',
        activeUntil: '2026-05-27T00:00:00Z',
        billingPeriod: 'annual',
        portalAction: { url: 'https://billing.openbin.app/portal', method: 'POST', fields: { token: 't' } },
      }),
    );
    render(<SubscriptionSection />);
    expect(screen.getByText(/Saving .* on annual billing/)).toBeInTheDocument();
    expect(screen.queryByText(/Switch to annual/)).toBeNull();
    expect(screen.getByText(/Manage Subscription/i)).toBeInTheDocument();
  });

  it('Plus paid monthly: shows Pro upsell card + annual switch primary + manage', () => {
    setPlan(
      makePlanInfo({
        plan: 'plus',
        status: 'active',
        activeUntil: '2026-05-27T00:00:00Z',
        billingPeriod: 'monthly',
        portalAction: { url: 'https://billing.openbin.app/portal', method: 'POST', fields: { token: 't' } },
        upgradeProAction: { url: 'https://billing.openbin.app/upgrade', method: 'POST', fields: { token: 't' } },
      }),
    );
    render(<SubscriptionSection />);
    expect(screen.getByRole('heading', { name: /Upgrade to Pro/i })).toBeInTheDocument();
    expect(screen.getByText(/Switch to annual — save/)).toBeInTheDocument();
    expect(screen.getByText(/Manage Subscription/i)).toBeInTheDocument();
  });

  it('Pro cancel-pending: shows Reactivate primary, hides Manage ghost + downgrade links', () => {
    setPlan(
      makePlanInfo({
        plan: 'pro',
        status: 'active',
        activeUntil: '2026-05-27T00:00:00Z',
        cancelAtPeriodEnd: '2026-05-27T00:00:00Z',
        portalAction: { url: 'https://billing.openbin.app/portal', method: 'POST', fields: { token: 't' } },
      }),
    );
    render(<SubscriptionSection />);
    expect(screen.getByText(/Reactivate/i)).toBeInTheDocument();
    expect(screen.queryByText(/Manage Subscription/i)).toBeNull();
    expect(screen.queryByText(/Downgrade to Plus/)).toBeNull();
    expect(screen.queryByText(/Switch to Free/)).toBeNull();
  });

  it('Active trial: renders CurrentPlanCard above PlanPicker + trial trust line + Switch to Free link', () => {
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    setPlan(
      makePlanInfo({
        plan: 'plus',
        status: 'trial',
        activeUntil: future,
      }),
    );
    render(<SubscriptionSection />);
    expect(screen.getByText('PLUS TRIAL')).toBeInTheDocument();
    expect(screen.getByText(/days remaining/)).toBeInTheDocument();
    expect(screen.getByText(/Cancel anytime · No questions asked/)).toBeInTheDocument();
    expect(screen.getByText('Switch to Free Plan')).toBeInTheDocument();
    // Picker is also visible
    expect(screen.getByRole('heading', { name: 'Plus' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
  });

  it('locked: shows Expired + resubscribe', () => {
    setPlan(
      makePlanInfo({
        plan: 'plus',
        status: 'inactive',
        locked: true,
        previousSubStatus: 'active',
        subscribePlanAction: {
          url: 'https://billing.openbin.app/sub',
          method: 'POST',
          fields: { token: 't' },
        },
      }),
    );
    render(<SubscriptionSection />);
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    expect(screen.getAllByText(/Resubscribe/i).length).toBeGreaterThan(0);
  });

  it('locked from trial: shows trial-ended message + Subscribe CTA', () => {
    setPlan(
      makePlanInfo({
        plan: 'plus',
        status: 'inactive',
        locked: true,
        previousSubStatus: 'trial',
        subscribePlanAction: {
          url: 'https://billing.openbin.app/sub',
          method: 'POST',
          fields: { token: 't' },
        },
      }),
    );
    render(<SubscriptionSection />);
    expect(screen.getByText(/trial has ended/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Subscribe/i).length).toBeGreaterThan(0);
  });
});
