import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanInfo, SubscriptionStatus } from '@/types';

vi.mock('@/lib/usePlan', () => ({
  usePlan: vi.fn(),
}));

import { usePlan } from '@/lib/usePlan';
import { AiCreditEstimate } from '../AiCreditEstimate';

const mockUsePlan = vi.mocked(usePlan);

function makePlanInfo(overrides: Partial<PlanInfo> & { aiCredits?: PlanInfo['aiCredits']; status?: SubscriptionStatus }): PlanInfo {
  return {
    plan: 'plus',
    status: 'active',
    activeUntil: null,
    previousSubStatus: null,
    selfHosted: false,
    locked: false,
    features: {
      ai: true, apiKeys: false, customFields: false, fullExport: true,
      reorganize: true, binSharing: false, attachments: false,
      maxBins: 100, maxLocations: 1, maxPhotoStorageMb: 100,
      maxMembersPerLocation: 1, activityRetentionDays: 30,
      aiCreditsPerMonth: 100, reorganizeMaxBins: 10,
    },
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
    aiCredits: { used: 0, limit: 100, resetsAt: '2026-06-01T00:00:00.000Z' },
    cancelAtPeriodEnd: null,
    billingPeriod: null,
    trialPeriodDays: 7,
    ...overrides,
  };
}

function renderWith(planInfo: PlanInfo) {
  mockUsePlan.mockReturnValue({
    planInfo,
    isLoading: false,
    isPro: false, isPlus: false, isFree: false, isSelfHosted: false, isLocked: false,
    isGated: () => false,
    refresh: vi.fn(),
    usage: null, overLimits: null, isOverAnyLimit: false,
    isLocationOverLimit: () => false,
    refreshUsage: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<AiCreditEstimate>', () => {
  it('renders nothing when cost is 0', () => {
    renderWith(makePlanInfo({}));
    const { container } = render(<AiCreditEstimate cost={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('falls back to plain "Uses N credits" when aiCredits is null (self-host)', () => {
    renderWith(makePlanInfo({ aiCredits: null }));
    render(<AiCreditEstimate cost={5} />);
    expect(screen.getByText('Uses 5 credits')).toBeInTheDocument();
    expect(screen.queryByText(/limit/i)).toBeNull();
  });

  it('falls back to plain "Uses N credits" when limit is 0 (Pro unlimited)', () => {
    renderWith(makePlanInfo({ aiCredits: { used: 42, limit: 0, resetsAt: null } }));
    render(<AiCreditEstimate cost={10} />);
    expect(screen.getByText('Uses 10 credits')).toBeInTheDocument();
    expect(screen.queryByText(/limit/i)).toBeNull();
  });

  it('shows percent of monthly limit for an active plan', () => {
    renderWith(makePlanInfo({
      aiCredits: { used: 10, limit: 100, resetsAt: '2026-06-01T00:00:00.000Z' },
    }));
    render(<AiCreditEstimate cost={24} />);
    expect(screen.getByText('Uses 24 credits · 24% of monthly limit')).toBeInTheDocument();
  });

  it('uses singular "credit" copy for cost = 1', () => {
    renderWith(makePlanInfo({
      aiCredits: { used: 0, limit: 100, resetsAt: '2026-06-01T00:00:00.000Z' },
    }));
    render(<AiCreditEstimate cost={1} />);
    expect(screen.getByText('Uses 1 credit · 1% of monthly limit')).toBeInTheDocument();
  });

  it('switches copy to "trial credits" when status is trial', () => {
    renderWith(makePlanInfo({
      status: 'trial',
      aiCredits: { used: 5, limit: 75, resetsAt: null },
    }));
    render(<AiCreditEstimate cost={10} />);
    expect(screen.getByText(/of trial credits/)).toBeInTheDocument();
    expect(screen.queryByText(/monthly limit/)).toBeNull();
  });

  it('renders amber tone when projected use exceeds 80% of limit', () => {
    renderWith(makePlanInfo({
      aiCredits: { used: 80, limit: 100, resetsAt: '2026-06-01T00:00:00.000Z' },
    }));
    const { container } = render(<AiCreditEstimate cost={5} />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('text-amber-600');
  });

  it('renders red tone and "would exceed" copy when cost would push over the limit', () => {
    renderWith(makePlanInfo({
      aiCredits: { used: 95, limit: 100, resetsAt: '2026-06-01T00:00:00.000Z' },
    }));
    const { container } = render(<AiCreditEstimate cost={20} />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('text-red-600');
    expect(span.textContent).toMatch(/would exceed your monthly limit/);
  });

  it('forwards className for layout adjustments', () => {
    renderWith(makePlanInfo({}));
    const { container } = render(<AiCreditEstimate cost={5} className="ml-2" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('ml-2');
  });
});
