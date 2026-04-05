import { describe, expect, it } from 'vitest';
import { isGatedPlan } from '@/lib/planGate';

describe('isGatedPlan', () => {
  it('returns true for free plan', () => {
    expect(isGatedPlan('free')).toBe(true);
  });

  it('returns false for plus plan', () => {
    expect(isGatedPlan('plus')).toBe(false);
  });

  it('returns false for pro plan', () => {
    expect(isGatedPlan('pro')).toBe(false);
  });
});
