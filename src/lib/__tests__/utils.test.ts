import { describe, expect, it } from 'vitest';
import { pluralize } from '@/lib/utils';

describe('pluralize', () => {
  it('returns singular for count 1', () => {
    expect(pluralize(1, 'item')).toBe('1 item');
  });
  it('returns plural for count 0', () => {
    expect(pluralize(0, 'item')).toBe('0 items');
  });
  it('returns plural for count > 1', () => {
    expect(pluralize(5, 'item')).toBe('5 items');
  });
  it('uses explicit plural when provided', () => {
    expect(pluralize(2, 'child', 'children')).toBe('2 children');
  });
});
