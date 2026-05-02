import { describe, expect, it } from 'vitest';
import { AI_CREDIT_WEIGHTS, reorganizeWeight, visionWeight } from '../aiCreditWeights.js';
import type { AiTaskGroup } from '../config.js';

describe('AI_CREDIT_WEIGHTS', () => {
  it('quickText baseline costs 1 credit', () => {
    expect(AI_CREDIT_WEIGHTS.quickText).toBe(1);
  });

  it('covers every AiTaskGroup', () => {
    const groups: AiTaskGroup[] = ['quickText', 'vision', 'deepText'];
    for (const g of groups) {
      expect(AI_CREDIT_WEIGHTS).toHaveProperty(g);
    }
  });
});

describe('visionWeight', () => {
  it('charges 5 credits for a single image', () => {
    expect(visionWeight(1)).toBe(5);
  });

  it('charges 10 credits for two images', () => {
    expect(visionWeight(2)).toBe(10);
  });

  it('charges 15 credits for three images', () => {
    expect(visionWeight(3)).toBe(15);
  });

  it('floors zero or negative counts to a single-image charge', () => {
    expect(visionWeight(0)).toBe(5);
    expect(visionWeight(-1)).toBe(5);
  });

  it('rounds non-integer counts up to the next image', () => {
    expect(visionWeight(1.5)).toBe(10);
  });
});

describe('reorganizeWeight', () => {
  it('charges 14 credits for 7 bins', () => {
    expect(reorganizeWeight(7)).toBe(14);
  });

  it('charges 60 credits for 30 bins', () => {
    expect(reorganizeWeight(30)).toBe(60);
  });

  it('charges 200 credits for 100 bins', () => {
    expect(reorganizeWeight(100)).toBe(200);
  });

  it('charges 0 for an empty bin list', () => {
    expect(reorganizeWeight(0)).toBe(0);
  });

  it('clamps negative counts to zero before charging', () => {
    expect(reorganizeWeight(-1)).toBe(0);
  });
});
