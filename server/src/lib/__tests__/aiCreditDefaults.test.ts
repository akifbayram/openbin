import { describe, expect, it } from 'vitest';
import { config } from '../config.js';

// These defaults are sized for ~4× pricing headroom on the new weighted
// credit system. A change here must be coordinated with the website
// pricing copy and the Stripe price IDs — see spec.
describe('AI credit defaults — weighted credit system', () => {
  it('Free plan defaults to 30 monthly credits', () => {
    expect(config.planLimits.freeAiCreditsPerMonth).toBe(30);
  });

  it('Plus plan defaults to 100 monthly credits', () => {
    expect(config.planLimits.plusAiCreditsPerMonth).toBe(100);
  });

  it('Pro plan defaults to 700 monthly credits', () => {
    expect(config.planLimits.proAiCreditsPerMonth).toBe(700);
  });

  it('Trial defaults to 75 lifetime credits', () => {
    expect(config.planLimits.trialAiCredits).toBe(75);
  });
});
