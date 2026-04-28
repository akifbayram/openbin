import { describe, expect, it } from 'vitest';
import { shouldHideMetric, tone } from '../hideRule';

describe('shouldHideMetric', () => {
  it('hides when limit is null (unlimited)', () => {
    expect(shouldHideMetric({ used: 5, limit: null })).toBe(true);
  });

  it('hides when limit is 0 (feature not in plan)', () => {
    expect(shouldHideMetric({ used: 0, limit: 0 })).toBe(true);
  });

  it('hides when limit is 1 (single-slot baseline)', () => {
    expect(shouldHideMetric({ used: 1, limit: 1 })).toBe(true);
  });

  it('shows for limit > 1', () => {
    expect(shouldHideMetric({ used: 0, limit: 10 })).toBe(false);
    expect(shouldHideMetric({ used: 5, limit: 10 })).toBe(false);
    expect(shouldHideMetric({ used: 10, limit: 10 })).toBe(false);
  });
});

describe('tone', () => {
  it('returns neutral below 60%', () => {
    expect(tone(5, 10)).toBe('neutral');
  });

  it('returns amber between 60% and 80%', () => {
    expect(tone(7, 10)).toBe('amber');
  });

  it('returns red at or above 80%', () => {
    expect(tone(8, 10)).toBe('red');
    expect(tone(10, 10)).toBe('red');
  });
});
