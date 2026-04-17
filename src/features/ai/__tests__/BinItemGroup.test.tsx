import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BinItemGroup } from '../BinItemGroup';
import type { QueryMatch } from '../useInventoryQuery';

const match: QueryMatch = {
  bin_id: 'b1',
  name: 'Camping Gear',
  area_name: 'Garage',
  items: [
    { id: 'i1', name: 'Tent', quantity: null },
    { id: 'i2', name: 'Sleeping bag', quantity: 4 },
  ],
  tags: [],
  relevance: '',
  icon: '',
  color: '#22c55e',
};

describe('BinItemGroup', () => {
  it('renders header and each item', () => {
    render(<BinItemGroup match={match} onBinClick={vi.fn()} />);
    expect(screen.getByText('Camping Gear')).toBeDefined();
    expect(screen.getByText('Tent')).toBeDefined();
    expect(screen.getByText('Sleeping bag')).toBeDefined();
  });

  it('does not render item rows when items is empty', () => {
    render(<BinItemGroup match={{ ...match, items: [] }} onBinClick={vi.fn()} />);
    expect(screen.queryByText('Tent')).toBeNull();
  });
});
