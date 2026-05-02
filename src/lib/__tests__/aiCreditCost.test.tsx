import { render, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../usePlan', () => ({ usePlan: vi.fn() }));

import { CreditCost, computeCreditEstimate, formatCreditCompactSuffix, formatCreditSuffix, reorganizeWeight, useCreditCostLabel, visionWeight } from '../aiCreditCost';
import { usePlan } from '../usePlan';

describe('visionWeight (client mirror)', () => {
  it('charges 5 credits for 1 image', () => {
    expect(visionWeight(1)).toBe(5);
  });

  it('charges 10 credits for 2 images', () => {
    expect(visionWeight(2)).toBe(10);
  });

  it('charges 15 credits for 3 images', () => {
    expect(visionWeight(3)).toBe(15);
  });

  it('floors zero/negative to a single-image charge', () => {
    expect(visionWeight(0)).toBe(5);
    expect(visionWeight(-1)).toBe(5);
  });
});

describe('reorganizeWeight (client mirror)', () => {
  it('charges 14 for 7 bins', () => {
    expect(reorganizeWeight(7)).toBe(14);
  });

  it('charges 60 for 30 bins', () => {
    expect(reorganizeWeight(30)).toBe(60);
  });

  it('charges 0 for an empty bin list', () => {
    expect(reorganizeWeight(0)).toBe(0);
  });
});

describe('<CreditCost>', () => {
  it('renders the cost as small "Uses X credits" text', () => {
    const { getByText } = render(<CreditCost cost={5} />);
    expect(getByText(/Uses 5 credits/)).toBeTruthy();
  });

  it('uses the singular form when cost is 1', () => {
    const { getByText } = render(<CreditCost cost={1} />);
    expect(getByText(/Uses 1 credit\b/)).toBeTruthy();
  });

  it('renders nothing when cost is 0', () => {
    const { container } = render(<CreditCost cost={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('forwards a className for layout adjustments', () => {
    const { container } = render(<CreditCost cost={5} className="ml-2" />);
    const el = container.firstChild as HTMLElement | null;
    expect(el?.className).toContain('ml-2');
  });
});

describe('computeCreditEstimate', () => {
  it('returns null when cost is 0', () => {
    expect(computeCreditEstimate(0, { used: 10, limit: 100, resetsAt: 'x' }, 'active')).toBeNull();
  });

  it('returns null when aiCredits is null (self-host)', () => {
    expect(computeCreditEstimate(5, null, 'active')).toBeNull();
  });

  it('returns null when limit is 0 (Pro unlimited or Free no-AI)', () => {
    expect(computeCreditEstimate(5, { used: 10, limit: 0, resetsAt: null }, 'active')).toBeNull();
  });

  it('computes percent of limit for an active plan', () => {
    const e = computeCreditEstimate(24, { used: 10, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(e?.percent).toBe(24);
    expect(e?.projected).toBe(34);
    expect(e?.tone).toBe('neutral');
    expect(e?.overLimit).toBe(false);
    expect(e?.isTrial).toBe(false);
  });

  it('caps percent at 100 when single cost exceeds limit', () => {
    const e = computeCreditEstimate(150, { used: 0, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(e?.percent).toBe(100);
    expect(e?.overLimit).toBe(true);
    expect(e?.tone).toBe('red');
  });

  it('flags trial when status is trial', () => {
    const e = computeCreditEstimate(10, { used: 0, limit: 75, resetsAt: '2026-06-01' }, 'trial');
    expect(e?.isTrial).toBe(true);
  });

  it('flags trial when resetsAt is null even with active status', () => {
    const e = computeCreditEstimate(10, { used: 0, limit: 75, resetsAt: null }, 'active');
    expect(e?.isTrial).toBe(true);
  });

  it('returns amber tone when projected use is past 80% but not over the limit', () => {
    const e = computeCreditEstimate(5, { used: 80, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(e?.tone).toBe('amber');
    expect(e?.overLimit).toBe(false);
  });

  it('returns red tone and overLimit when projected exceeds limit', () => {
    const e = computeCreditEstimate(20, { used: 95, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(e?.tone).toBe('red');
    expect(e?.overLimit).toBe(true);
  });

  it('stays neutral exactly at the 80% threshold', () => {
    // projected = 80, limit = 100. Test uses strict-greater-than for the
    // amber edge — at 80 exactly, tone is neutral.
    const e = computeCreditEstimate(40, { used: 40, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(e?.tone).toBe('neutral');
  });
});

describe('formatCreditSuffix', () => {
  it('returns empty string for null estimate (self-host fallback)', () => {
    expect(formatCreditSuffix(null)).toBe('');
  });

  it('returns parenthesized percent for normal estimate', () => {
    const e = computeCreditEstimate(24, { used: 0, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(formatCreditSuffix(e)).toBe(' (24%)');
  });

  it('returns "would exceed monthly limit" for over-limit, non-trial', () => {
    const e = computeCreditEstimate(50, { used: 90, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(formatCreditSuffix(e)).toBe(' (would exceed monthly limit)');
  });

  it('returns "would exceed trial credits" for over-limit on trial', () => {
    const e = computeCreditEstimate(20, { used: 70, limit: 75, resetsAt: null }, 'trial');
    expect(formatCreditSuffix(e)).toBe(' (would exceed trial credits)');
  });
});

describe('formatCreditCompactSuffix', () => {
  it('returns empty string for null estimate', () => {
    expect(formatCreditCompactSuffix(null)).toBe('');
  });

  it('returns " · X%" for normal estimate', () => {
    const e = computeCreditEstimate(24, { used: 0, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(formatCreditCompactSuffix(e)).toBe(' · 24%');
  });

  it('returns " · over" for over-limit estimate', () => {
    const e = computeCreditEstimate(50, { used: 90, limit: 100, resetsAt: '2026-06-01' }, 'active');
    expect(formatCreditCompactSuffix(e)).toBe(' · over');
  });
});

describe('useCreditCostLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupPlan(aiCredits: { used: number; limit: number; resetsAt: string | null } | null, status: 'active' | 'trial' | 'inactive' = 'active') {
    vi.mocked(usePlan).mockReturnValue({
      planInfo: { aiCredits, status } as never,
    } as never);
  }

  it('composes label and compactSuffix from plan info', () => {
    setupPlan({ used: 10, limit: 100, resetsAt: '2026-06-01' });
    const { result } = renderHook(() => useCreditCostLabel('Reanalyze with AI', 5));
    expect(result.current.label).toBe('Reanalyze with AI · 5 credits (5%)');
    expect(result.current.compactSuffix).toBe(' · 5%');
  });

  it('omits the percent when aiCredits is null (self-host)', () => {
    setupPlan(null);
    const { result } = renderHook(() => useCreditCostLabel('Voice input', 1));
    expect(result.current.label).toBe('Voice input · 1 credit');
    expect(result.current.compactSuffix).toBe('');
  });

  it('renders "would exceed" copy when projected exceeds limit', () => {
    setupPlan({ used: 95, limit: 100, resetsAt: '2026-06-01' });
    const { result } = renderHook(() => useCreditCostLabel('Reorganize', 20));
    expect(result.current.label).toBe('Reorganize · 20 credits (would exceed monthly limit)');
    expect(result.current.compactSuffix).toBe(' · over');
  });
});
