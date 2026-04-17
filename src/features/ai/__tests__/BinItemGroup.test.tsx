import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BinItemGroup } from '../BinItemGroup';
import type { QueryMatch } from '../useInventoryQuery';

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/features/items/itemActions', () => ({
  checkoutItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  removeItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  renameItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  updateQuantitySafe: vi.fn().mockResolvedValue({ ok: true, quantity: null }),
}));

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
    render(
      <MemoryRouter>
        <BinItemGroup match={match} canWrite={false} onBinClick={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Camping Gear')).toBeDefined();
    expect(screen.getByText('Tent')).toBeDefined();
    expect(screen.getByText('Sleeping bag')).toBeDefined();
  });

  it('does not render item rows when items is empty', () => {
    render(
      <MemoryRouter>
        <BinItemGroup match={{ ...match, items: [] }} canWrite={false} onBinClick={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Tent')).toBeNull();
  });
});
