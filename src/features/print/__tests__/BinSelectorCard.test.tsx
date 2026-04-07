import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Area, Bin } from '@/types';
import { BinSelectorCard } from '../BinSelectorCard';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({ bins: 'bins', bin: 'bin', Bin: 'Bin', Bins: 'Bins', location: 'location', area: 'area' }),
}));

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'b1',
    short_code: 'b1',
    location_id: 'loc1',
    name: 'Tools',
    area_id: null,
    area_name: '',
    items: [],
    notes: '',
    tags: [],
    icon: 'Wrench',
    color: '30:3',
    card_style: '',
    created_by: 'u1',
    created_by_name: 'User',
    visibility: 'location',
    custom_fields: {},
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

const defaultProps = {
  areas: [] as Area[],
  selectedIds: new Set<string>(),
  toggleBin: vi.fn(),
  selectAll: vi.fn(),
  selectNone: vi.fn(),
  toggleArea: vi.fn(),
  expanded: true,
  onExpandedChange: vi.fn(),
};

/** The icon layer inside BinIconBadge (first child in interactive mode). */
function getIconLayer(badge: HTMLElement) {
  return (badge.firstElementChild ?? badge) as HTMLElement;
}

describe('BinSelectorCard icon+color badge', () => {
  it('renders a combined icon+color badge with data-testid="bin-icon-badge"', () => {
    render(
      <BinSelectorCard allBins={[makeBin()]} {...defaultProps} />,
    );
    const badge = screen.getByTestId('bin-icon-badge');
    expect(badge).toBeTruthy();
  });

  it('applies the bin color as background on the badge', () => {
    render(
      <BinSelectorCard allBins={[makeBin()]} {...defaultProps} />,
    );
    const badge = screen.getByTestId('bin-icon-badge');
    const layer = getIconLayer(badge);
    expect(layer.style.backgroundColor).toBeTruthy();
    expect(layer.style.backgroundColor).not.toBe('var(--text-tertiary)');
  });

  it('falls back to tertiary background when bin has no color', () => {
    render(
      <BinSelectorCard allBins={[makeBin({ color: '' })]} {...defaultProps} />,
    );
    const badge = screen.getByTestId('bin-icon-badge');
    const layer = getIconLayer(badge);
    expect(layer.style.backgroundColor).toBe('var(--text-tertiary)');
  });

  it('does not render a separate rounded-full color dot', () => {
    const { container } = render(
      <BinSelectorCard allBins={[makeBin()]} {...defaultProps} />,
    );
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(0);
  });
});
