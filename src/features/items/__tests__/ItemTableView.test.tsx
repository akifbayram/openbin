import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ItemTableView } from '../ItemTableView';
import type { ItemEntry } from '../useItems';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({ bins: 'bins', bin: 'bin', Bin: 'Bin', location: 'location', area: 'area' }),
}));

function makeItem(overrides: Partial<ItemEntry> = {}): ItemEntry {
  return {
    id: 'item-1',
    name: 'Hammer',
    quantity: 3,
    bin_id: 'b1',
    bin_name: 'Tools',
    bin_icon: 'Wrench',
    bin_color: '30:3',
    ...overrides,
  };
}

const defaultProps = {
  sortColumn: 'alpha' as const,
  sortDirection: 'asc' as const,
  onSortChange: vi.fn(),
  searchQuery: '',
  hasMore: false,
  isLoadingMore: false,
  loadMore: vi.fn(),
};

describe('ItemTableView icon+color badge', () => {
  it('renders a combined icon+color badge with data-testid="bin-icon-badge"', () => {
    render(
      <MemoryRouter>
        <ItemTableView items={[makeItem()]} {...defaultProps} />
      </MemoryRouter>,
    );
    const badge = screen.getByTestId('bin-icon-badge');
    expect(badge).toBeTruthy();
  });

  it('applies the bin color as background on the badge', () => {
    render(
      <MemoryRouter>
        <ItemTableView items={[makeItem()]} {...defaultProps} />
      </MemoryRouter>,
    );
    const badge = screen.getByTestId('bin-icon-badge');
    expect(badge.style.backgroundColor).toBeTruthy();
    // Should NOT be the tertiary text color fallback
    expect(badge.style.backgroundColor).not.toBe('var(--text-tertiary)');
  });

  it('falls back to tertiary background when bin has no color', () => {
    render(
      <MemoryRouter>
        <ItemTableView items={[makeItem({ bin_color: '' })]} {...defaultProps} />
      </MemoryRouter>,
    );
    const badge = screen.getByTestId('bin-icon-badge');
    expect(badge.style.backgroundColor).toBe('var(--text-tertiary)');
  });

  it('does not render a separate color dot element', () => {
    const { container } = render(
      <MemoryRouter>
        <ItemTableView items={[makeItem()]} {...defaultProps} />
      </MemoryRouter>,
    );
    // The old pattern had a h-2 w-2 rounded-full dot — should no longer exist
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(0);
  });
});
