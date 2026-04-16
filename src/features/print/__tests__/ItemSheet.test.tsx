import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Area, Bin } from '@/types';
import { ItemSheet } from '../ItemSheet';
import { DEFAULT_ITEM_LIST_OPTIONS, DEFAULT_QR_STYLE } from '../usePrintSettings';

vi.mock('../itemSheetQr', () => ({
  generateItemSheetQrMap: vi.fn(async (binIds: string[]) => {
    const map = new Map<string, string>();
    for (const id of binIds) map.set(id, `data:image/png;base64,${id}`);
    return map;
  }),
}));

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'B1',
    short_code: 'ABC123',
    location_id: 'loc1',
    name: 'Winter Gear',
    area_id: null,
    area_name: '',
    items: [
      { id: 'i1', name: 'Gloves', quantity: 2 },
      { id: 'i2', name: 'Hat', quantity: 1 },
    ],
    notes: '',
    tags: [],
    icon: 'Package',
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

function makeArea(overrides: Partial<Area> = {}): Area {
  return {
    id: 'a1',
    location_id: 'loc1',
    name: 'Basement',
    parent_id: null,
    bin_count: 0,
    descendant_bin_count: 0,
    created_by: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

const baseProps = {
  bins: [makeBin()],
  areas: [] as Area[],
  qrStyle: DEFAULT_QR_STYLE,
  ...DEFAULT_ITEM_LIST_OPTIONS,
};

describe('ItemSheet empty state', () => {
  it('renders "No bins selected" when given no bins', () => {
    render(<ItemSheet {...baseProps} bins={[]} />);
    expect(screen.getByText('No bins selected')).toBeTruthy();
  });
});

describe('ItemSheet header', () => {
  it('renders the bin name', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
  });

  it('renders the short code when showBinCode is true', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('ABC123')).toBeTruthy());
  });

  it('hides the short code when showBinCode is false', async () => {
    render(<ItemSheet {...baseProps} showBinCode={false} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.queryByText('ABC123')).toBeNull();
  });

  it('renders an item count when showItemCount is true', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('2 items')).toBeTruthy());
  });

  it('shows "1 item" singular when count is one', async () => {
    const bin = makeBin({ items: [{ id: 'i1', name: 'Gloves', quantity: 1 }] });
    render(<ItemSheet {...baseProps} bins={[bin]} />);
    await waitFor(() => expect(screen.getByText('1 item')).toBeTruthy());
  });

  it('hides the item count when showItemCount is false', async () => {
    render(<ItemSheet {...baseProps} showItemCount={false} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.queryByText('2 items')).toBeNull();
  });

  it('renders the QR as an img when showQrCode is true', async () => {
    render(<ItemSheet {...baseProps} />);
    const qr = await screen.findByTestId('item-sheet-qr-B1');
    expect(qr.tagName).toBe('IMG');
    expect((qr as HTMLImageElement).src).toContain('data:image/png;base64,B1');
  });

  it('omits the QR when showQrCode is false', async () => {
    render(<ItemSheet {...baseProps} showQrCode={false} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.queryByTestId('item-sheet-qr-B1')).toBeNull();
  });

  it('renders the area path from the areas tree when showAreaPath is true', async () => {
    const areas = [
      makeArea({ id: 'a1', name: 'Basement', parent_id: null }),
      makeArea({ id: 'a2', name: 'Shelf B', parent_id: 'a1' }),
    ];
    const bin = makeBin({ area_id: 'a2', area_name: 'Shelf B' });
    render(<ItemSheet {...baseProps} bins={[bin]} areas={areas} />);
    await waitFor(() => expect(screen.getByText('Basement / Shelf B')).toBeTruthy());
  });

  it('hides the area path when area_id is null', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.queryByTestId('item-sheet-area-path')).toBeNull();
  });

  it('hides the area path when showAreaPath is false', async () => {
    const areas = [makeArea({ id: 'a1', name: 'Basement' })];
    const bin = makeBin({ area_id: 'a1', area_name: 'Basement' });
    render(<ItemSheet {...baseProps} bins={[bin]} areas={areas} showAreaPath={false} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.queryByText('Basement')).toBeNull();
  });

  it('renders the icon when showIcon is true', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('item-sheet-icon-B1')).toBeTruthy());
  });

  it('omits the icon when showIcon is false', async () => {
    render(<ItemSheet {...baseProps} showIcon={false} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.queryByTestId('item-sheet-icon-B1')).toBeNull();
  });
});

describe('ItemSheet bin notes block', () => {
  it('renders bin notes when present and showBinNotes is true', async () => {
    const bin = makeBin({ notes: 'Sorted by season.' });
    render(<ItemSheet {...baseProps} bins={[bin]} />);
    await waitFor(() => expect(screen.getByText(/Sorted by season/)).toBeTruthy());
  });

  it('omits the bin notes block when notes are empty', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.queryByTestId('item-sheet-bin-notes-B1')).toBeNull();
  });

  it('omits the bin notes block when showBinNotes is false', async () => {
    const bin = makeBin({ notes: 'Sorted by season.' });
    render(<ItemSheet {...baseProps} bins={[bin]} showBinNotes={false} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.queryByText(/Sorted by season/)).toBeNull();
  });
});

describe('ItemSheet table', () => {
  it('renders each item row', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    expect(screen.getByText('Hat')).toBeTruthy();
  });

  it('renders the Notes column header when showNotesColumn is true', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Notes')).toBeTruthy());
  });

  it('omits the Notes column header when showNotesColumn is false', async () => {
    render(<ItemSheet {...baseProps} showNotesColumn={false} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    expect(screen.queryByText('Notes')).toBeNull();
  });

  it('renders the Qty column header when showQuantity is true', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    expect(screen.getByText('Qty')).toBeTruthy();
  });

  it('omits the Qty column header when showQuantity is false', async () => {
    render(<ItemSheet {...baseProps} showQuantity={false} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    expect(screen.queryByText('Qty')).toBeNull();
  });

  it('applies zebra class to odd rows when zebraStripes is true', async () => {
    render(<ItemSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    const rows = document.querySelectorAll('.item-sheet-table tbody tr');
    expect(rows[0]?.classList.contains('item-sheet-zebra')).toBe(false);
    expect(rows[1]?.classList.contains('item-sheet-zebra')).toBe(true);
  });

  it('does not apply zebra class when zebraStripes is false', async () => {
    render(<ItemSheet {...baseProps} zebraStripes={false} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    const rows = document.querySelectorAll('.item-sheet-table tbody tr');
    for (const r of rows) expect(r.classList.contains('item-sheet-zebra')).toBe(false);
  });

  it('appends the configured number of blank rows', async () => {
    render(<ItemSheet {...baseProps} blankRowCount={3} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    const blanks = document.querySelectorAll('.item-sheet-blank-row');
    expect(blanks.length).toBe(3);
  });

  it('renders zero blank rows when blankRowCount is 0', async () => {
    render(<ItemSheet {...baseProps} blankRowCount={0} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    expect(document.querySelectorAll('.item-sheet-blank-row').length).toBe(0);
  });

  it('continues zebra striping onto the blank rows', async () => {
    render(<ItemSheet {...baseProps} blankRowCount={2} />);
    await waitFor(() => expect(screen.getByText('Gloves')).toBeTruthy());
    // Two items + two blanks: rows at index 0 and 2 are unstriped; 1 and 3 are striped.
    const rows = document.querySelectorAll('.item-sheet-table tbody tr');
    expect(rows.length).toBe(4);
    expect(rows[0]?.classList.contains('item-sheet-zebra')).toBe(false);
    expect(rows[1]?.classList.contains('item-sheet-zebra')).toBe(true);
    expect(rows[2]?.classList.contains('item-sheet-zebra')).toBe(false);
    expect(rows[3]?.classList.contains('item-sheet-zebra')).toBe(true);
  });

  it('renders a capture table (headers + blanks) when a bin has no items but blankRowCount > 0', async () => {
    const bin = makeBin({ items: [] });
    render(<ItemSheet {...baseProps} bins={[bin]} blankRowCount={3} />);
    await waitFor(() => expect(screen.getByText('Winter Gear')).toBeTruthy());
    expect(screen.getByText('Item')).toBeTruthy();
    expect(document.querySelectorAll('.item-sheet-blank-row').length).toBe(3);
    expect(screen.queryByText('No items')).toBeNull();
  });

  it('renders the empty placeholder when no items and blankRowCount = 0', async () => {
    const bin = makeBin({ items: [] });
    render(<ItemSheet {...baseProps} bins={[bin]} blankRowCount={0} />);
    await waitFor(() => expect(screen.getByText('No items')).toBeTruthy());
    expect(screen.queryByText('Item')).toBeNull();
  });
});
