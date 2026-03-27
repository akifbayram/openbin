import { describe, expect, it } from 'vitest';
import { isGatedPlan } from '@/lib/planGate';

describe('isGatedPlan', () => {
  it('returns true for lite plan', () => {
    expect(isGatedPlan('lite')).toBe(true);
  });

  it('returns false for pro plan', () => {
    expect(isGatedPlan('pro')).toBe(false);
  });
});
