import { describe, expect, it } from 'vitest';
import { parseItemQuantity } from '../itemQuantities';

describe('parseItemQuantity', () => {
  it('parses trailing x with no space before number', () => {
    expect(parseItemQuantity('screws x10')).toEqual({ name: 'screws', quantity: 10 });
  });

  it('parses trailing x with space before number', () => {
    expect(parseItemQuantity('screws x 10')).toEqual({ name: 'screws', quantity: 10 });
  });

  it('parses trailing parenthesized quantity', () => {
    expect(parseItemQuantity('bolts (5)')).toEqual({ name: 'bolts', quantity: 5 });
  });

  it('parses leading Nx prefix', () => {
    expect(parseItemQuantity('10x washers')).toEqual({ name: 'washers', quantity: 10 });
  });

  it('parses trailing comma-separated quantity', () => {
    expect(parseItemQuantity('nails, 25')).toEqual({ name: 'nails', quantity: 25 });
  });

  it('does not treat ambiguous product names as quantity (2x4 lumber)', () => {
    expect(parseItemQuantity('2x4 lumber')).toEqual({ name: '2x4 lumber', quantity: null });
  });

  it('returns null quantity for plain items', () => {
    expect(parseItemQuantity('plain item')).toEqual({ name: 'plain item', quantity: null });
  });

  it('treats zero quantity as no match', () => {
    expect(parseItemQuantity('item x0')).toEqual({ name: 'item x0', quantity: null });
  });

  it('trims whitespace from name and input', () => {
    expect(parseItemQuantity('  spaced  x 3  ')).toEqual({ name: 'spaced', quantity: 3 });
  });
});
