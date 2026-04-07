import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Bin, CustomField } from '@/types';
import { BinTableView } from '../BinTableView';

// Mock hooks that need context providers
vi.mock('@/features/tags/useTagStyle', () => ({
  useTagStyle: () => () => undefined,
}));
vi.mock('@/features/bins/useBinCardInteraction', () => ({
  useBinCardInteraction: () => ({
    handleClick: vi.fn(),
    handleKeyDown: vi.fn(),
    longPress: { onTouchStart: vi.fn(), onTouchEnd: vi.fn(), onTouchMove: vi.fn(), onContextMenu: vi.fn() },
  }),
}));

const FIELDS: CustomField[] = [
  { id: 'f1', location_id: 'loc1', name: 'Serial', position: 0, created_at: '', updated_at: '' },
  { id: 'f2', location_id: 'loc1', name: 'Warranty', position: 1, created_at: '', updated_at: '' },
];

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'b1', short_code: 'b1', location_id: 'loc1', name: 'Test Bin',
    area_id: null, area_name: '', items: [], notes: '', tags: [],
    icon: 'package', color: '', card_style: '', created_by: 'u1',
    created_by_name: 'User', visibility: 'location',
    custom_fields: {}, created_at: '2024-01-01', updated_at: '2024-01-01',
    ...overrides,
  };
}

function renderTable(options: { bins?: Bin[]; customFields?: CustomField[]; isVisible?: (f: string) => boolean } = {}) {
  const {
    bins = [makeBin({ custom_fields: { f1: 'SN-001', f2: 'Jan 2025' } })],
    customFields = FIELDS,
    isVisible = () => true,
  } = options;
  return render(
    <MemoryRouter>
      <BinTableView
        bins={bins}
        customFields={customFields}
        sortColumn="name"
        sortDirection="asc"
        onSortChange={vi.fn()}
        selectable={false}
        selectedIds={new Set()}
        onSelect={vi.fn()}
        searchQuery=""
        onTagClick={vi.fn()}
        isVisible={isVisible}
      />
    </MemoryRouter>,
  );
}

describe('BinTableView custom field columns', () => {
  it('renders a column header per custom field', () => {
    renderTable();
    expect(screen.getByText('Serial')).toBeDefined();
    expect(screen.getByText('Warranty')).toBeDefined();
  });

  it('renders cell value for each custom field', () => {
    renderTable();
    expect(screen.getByText('SN-001')).toBeDefined();
    expect(screen.getByText('Jan 2025')).toBeDefined();
  });

  it('hides column when isVisible returns false for cf_ key', () => {
    renderTable({ isVisible: (f) => f !== 'cf_f2' });
    expect(screen.getByText('Serial')).toBeDefined();
    expect(screen.queryByText('Warranty')).toBeNull();
    expect(screen.queryByText('Jan 2025')).toBeNull();
  });

  it('renders empty cell when bin has no value for a custom field', () => {
    const bin = makeBin({ custom_fields: { f1: 'SN-001' } });
    renderTable({ bins: [bin] });
    expect(screen.getByText('SN-001')).toBeDefined();
    // Warranty column header exists but no cell value
    expect(screen.getByText('Warranty')).toBeDefined();
  });

  it('does not render old single Custom Fields column', () => {
    renderTable();
    // The old "Custom Fields" column header should not exist
    expect(screen.queryByText('Custom Fields')).toBeNull();
  });
});

describe('BinTableView combined color+icon badge', () => {
  it('renders icon inside a colored badge with background-color', () => {
    const { container } = renderTable({
      bins: [makeBin({ color: '0-2', icon: 'box' })],
    });
    const badge = container.querySelector('[data-testid="bin-icon-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('style')).toContain('background-color');
  });

  it('uses tertiary fallback color when bin has no color', () => {
    const { container } = renderTable({
      bins: [makeBin({ color: '' })],
    });
    const badge = container.querySelector('[data-testid="bin-icon-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('style')).toContain('--text-tertiary');
  });

  it('hides badge when icon visibility is off', () => {
    const { container } = renderTable({
      bins: [makeBin({ color: '0-2' })],
      isVisible: (f) => f !== 'icon',
    });
    const badge = container.querySelector('[data-testid="bin-icon-badge"]');
    expect(badge).toBeNull();
  });

  it('does not render a standalone color dot in the checkbox area', () => {
    const { container } = renderTable({
      bins: [makeBin({ color: '0-2' })],
    });
    // The select button should not contain any element with a background-color style
    const selectBtn = container.querySelector('[aria-label="Select"]');
    const coloredChildren = selectBtn?.querySelectorAll('[style*="background-color"]') ?? [];
    expect(coloredChildren.length).toBe(0);
  });
});
