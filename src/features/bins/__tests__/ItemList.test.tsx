import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BinItem } from '@/types';
import { ItemList } from '../ItemList';
import { setItemPageSize } from '../useItemPageSize';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 'test' })) }));
vi.mock('@/components/ui/toast', () => ({
  useToast: vi.fn(() => ({ showToast: vi.fn(), updateToast: vi.fn() })),
}));
vi.mock('@/lib/usePermissions', () => ({
  usePermissions: vi.fn(() => ({ canWrite: true })),
}));
vi.mock('@/features/checkouts/useCheckouts', () => ({
  checkoutItem: vi.fn().mockResolvedValue(undefined),
  returnItem: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../useBins', () => ({
  removeItemFromBin: vi.fn().mockResolvedValue(undefined),
  renameItem: vi.fn().mockResolvedValue(undefined),
  reorderItems: vi.fn().mockResolvedValue(undefined),
}));

const { removeItemFromBin } = await import('../useBins');
const { useToast } = await import('@/components/ui/toast');

const items: BinItem[] = [
  { id: '1', name: 'Hammer', quantity: 2 },
  { id: '2', name: 'Nails', quantity: null },
  { id: '3', name: 'Screwdriver', quantity: 1 },
];

const unsortedItems: BinItem[] = [
  { id: '1', name: 'Cherry', quantity: 3 },
  { id: '2', name: 'Apple', quantity: 1 },
  { id: '3', name: 'Banana', quantity: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ItemList with onItemsChange (form mode)', () => {
  it('renders items in form mode (no binId)', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={items} onItemsChange={onItemsChange} />);
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    expect(screen.getByText('Nails')).toBeInTheDocument();
    expect(screen.getByText('Screwdriver')).toBeInTheDocument();
  });

  it('calls onItemsChange (not server API) when item is deleted from the row menu', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={items} onItemsChange={onItemsChange} />);

    const actionButtons = screen.getAllByLabelText('Item actions');
    fireEvent.click(actionButtons[0]); // open menu for Hammer
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    // After undo delay, onItemsChange should be called
    vi.advanceTimersByTime(6000);
    expect(onItemsChange).toHaveBeenCalledWith([
      { id: '2', name: 'Nails', quantity: null },
      { id: '3', name: 'Screwdriver', quantity: 1 },
    ]);
    expect(removeItemFromBin).not.toHaveBeenCalled();
  });
});

describe('ItemList header sorting', () => {
  it('sorts items A-Z when Name header is clicked', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={unsortedItems} onItemsChange={onItemsChange} />);

    fireEvent.click(screen.getByLabelText('Sort by Name'));

    expect(onItemsChange).toHaveBeenCalledWith([
      { id: '2', name: 'Apple', quantity: 1 },
      { id: '3', name: 'Banana', quantity: 2 },
      { id: '1', name: 'Cherry', quantity: 3 },
    ]);
  });

  it('toggles to Z-A on second Name header click', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={unsortedItems} onItemsChange={onItemsChange} />);

    fireEvent.click(screen.getByLabelText('Sort by Name'));
    fireEvent.click(screen.getByLabelText('Name, sorted ascending'));

    expect(onItemsChange).toHaveBeenLastCalledWith([
      { id: '1', name: 'Cherry', quantity: 3 },
      { id: '3', name: 'Banana', quantity: 2 },
      { id: '2', name: 'Apple', quantity: 1 },
    ]);
  });

  it('sorts items by quantity descending when Qty header is clicked', () => {
    const onItemsChange = vi.fn();
    const itemsWithQty: BinItem[] = [
      { id: '1', name: 'Apple', quantity: 1 },
      { id: '2', name: 'Banana', quantity: 5 },
      { id: '3', name: 'Cherry', quantity: 3 },
      { id: '4', name: 'Date', quantity: null },
    ];
    render(<ItemList items={itemsWithQty} onItemsChange={onItemsChange} />);

    fireEvent.click(screen.getByLabelText('Sort by Qty'));

    expect(onItemsChange).toHaveBeenCalledWith([
      { id: '2', name: 'Banana', quantity: 5 },
      { id: '3', name: 'Cherry', quantity: 3 },
      { id: '1', name: 'Apple', quantity: 1 },
      { id: '4', name: 'Date', quantity: null },
    ]);
  });

  it('toggles to quantity ascending on second Qty header click', () => {
    const onItemsChange = vi.fn();
    const itemsWithQty: BinItem[] = [
      { id: '1', name: 'Apple', quantity: 1 },
      { id: '2', name: 'Banana', quantity: 5 },
      { id: '3', name: 'Cherry', quantity: 3 },
      { id: '4', name: 'Date', quantity: null },
    ];
    render(<ItemList items={itemsWithQty} onItemsChange={onItemsChange} />);

    fireEvent.click(screen.getByLabelText('Sort by Qty'));
    fireEvent.click(screen.getByLabelText('Qty, sorted descending'));

    expect(onItemsChange).toHaveBeenLastCalledWith([
      { id: '1', name: 'Apple', quantity: 1 },
      { id: '3', name: 'Cherry', quantity: 3 },
      { id: '2', name: 'Banana', quantity: 5 },
      { id: '4', name: 'Date', quantity: null },
    ]);
  });

  it('does not render sort headers in readOnly mode', () => {
    render(<ItemList items={unsortedItems} readOnly />);

    expect(screen.queryByLabelText('Sort by Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sort by Qty')).not.toBeInTheDocument();
  });

  it('does not render sort headers with fewer than 2 items', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={[{ id: '1', name: 'Solo', quantity: 1 }]} onItemsChange={onItemsChange} />);

    expect(screen.queryByLabelText('Sort by Name')).not.toBeInTheDocument();
  });
});

describe('ItemList hideHeader', () => {
  it('hides the count header while still rendering items', () => {
    render(<ItemList items={items} readOnly hideHeader />);
    expect(screen.queryByText('3 Items')).not.toBeInTheDocument();
    expect(screen.getByText('Hammer')).toBeInTheDocument();
  });
});

describe('ItemList hideWhenEmpty', () => {
  it('renders nothing when hideWhenEmpty is true and items are empty', () => {
    const onItemsChange = vi.fn();
    const { container } = render(
      <ItemList items={[]} onItemsChange={onItemsChange} hideWhenEmpty />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows header and empty state when hideWhenEmpty is false and items are empty', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={[]} onItemsChange={onItemsChange} />);
    expect(screen.getByText('0 Items')).toBeInTheDocument();
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
  });

  it('renders items normally when hideWhenEmpty is true but items exist', () => {
    const onItemsChange = vi.fn();
    render(
      <ItemList items={items} onItemsChange={onItemsChange} hideWhenEmpty />,
    );
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    expect(screen.getByText('3 Items')).toBeInTheDocument();
  });
});

describe('ItemList qty input', () => {
  it('shows the quantity value in the input when set', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={[{ id: '1', name: 'Hammer', quantity: 3 }]} onItemsChange={onItemsChange} />);
    const qtyInput = screen.getByLabelText('Quantity') as HTMLInputElement;
    expect(qtyInput.value).toBe('3');
  });

  it('leaves the input empty when quantity is null', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={[{ id: '1', name: 'Nails', quantity: null }]} onItemsChange={onItemsChange} />);
    const qtyInput = screen.getByLabelText('Quantity') as HTMLInputElement;
    expect(qtyInput.value).toBe('');
  });

  it('keeps the qty input tab-reachable even when empty', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={[{ id: '1', name: 'Nails', quantity: null }]} onItemsChange={onItemsChange} />);
    // Input is always in the DOM regardless of value
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
  });

  it('does not render a × prefix on any row', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={[{ id: '1', name: 'Hammer', quantity: 3 }]} onItemsChange={onItemsChange} />);
    // The × (multiplication sign) chip was removed — qty now renders plain, like the name field.
    expect(screen.queryByText('×')).not.toBeInTheDocument();
    expect(screen.queryByText(/^×/)).not.toBeInTheDocument();
  });
});

describe('ItemList column header position', () => {
  it('renders Name header before Qty header (trailing qty)', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={items} onItemsChange={onItemsChange} />);
    const nameHeader = screen.getByLabelText('Sort by Name');
    const qtyHeader = screen.getByLabelText('Sort by Qty');
    // Name element should appear before Qty in DOM order
    const order = nameHeader.compareDocumentPosition(qtyHeader);
    // DOCUMENT_POSITION_FOLLOWING === 4 means qtyHeader follows nameHeader
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders column header in readOnly when items exist', () => {
    render(<ItemList items={items} readOnly />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
  });

  it('does not render column header when list is empty', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={[]} onItemsChange={onItemsChange} />);
    expect(screen.queryByText('Qty')).not.toBeInTheDocument();
  });
});

describe('ItemList checkout row subline', () => {
  const checkoutItem: BinItem = { id: '1', name: 'Hammer', quantity: 2 };
  const checkout = {
    id: 'c1',
    item_id: '1',
    origin_bin_id: 'bin1',
    location_id: 'loc1',
    checked_out_by: 'user1',
    checked_out_by_name: 'Jane',
    checked_out_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    returned_at: null,
    returned_by: null,
    return_bin_id: null,
  };

  it('renders the item name and a subline with who/when', () => {
    render(<ItemList items={[checkoutItem]} binId="bin1" checkouts={[checkout]} />);
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    // Subline contains "Out", user name, and relative time — use a regex for flexibility
    expect(screen.getByText(/Out.*Jane/)).toBeInTheDocument();
  });

  it('exposes a Return menuitem in the row action menu when canReturn is true', () => {
    render(<ItemList items={[checkoutItem]} binId="bin1" checkouts={[checkout]} />);
    fireEvent.click(screen.getByLabelText('Item actions'));
    expect(screen.getByRole('menuitem', { name: /return/i })).toBeInTheDocument();
  });

  it('does not render any row action menu in readOnly mode', () => {
    render(<ItemList items={[checkoutItem]} readOnly checkouts={[checkout]} />);
    expect(screen.queryByLabelText('Item actions')).not.toBeInTheDocument();
    // But the subline should still be visible for readers
    expect(screen.getByText(/Out.*Jane/)).toBeInTheDocument();
  });

  it('deletes a checked-out item when Delete is chosen from the menu', () => {
    render(<ItemList items={[checkoutItem]} binId="bin1" checkouts={[checkout]} />);

    fireEvent.click(screen.getByLabelText('Item actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    // Optimistic hide: checkout row is gone from the DOM
    expect(screen.queryByText(/Out.*Jane/)).not.toBeInTheDocument();

    // After the undo window closes, the server DELETE fires
    act(() => { vi.advanceTimersByTime(6000); });
    expect(removeItemFromBin).toHaveBeenCalledWith('bin1', '1', { quiet: true });
  });
});

describe('ItemList readOnly qty display', () => {
  it('renders the quantity as plain text when set (no × prefix)', () => {
    render(<ItemList items={[{ id: '1', name: 'Hammer', quantity: 3 }]} readOnly />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('×3')).not.toBeInTheDocument();
  });

  it('omits the qty cell on readOnly row when quantity is null', () => {
    render(<ItemList items={[{ id: '1', name: 'Nails', quantity: null }]} readOnly />);
    expect(screen.queryByText(/^×/)).not.toBeInTheDocument();
    // The name still renders; the qty column is simply absent from the row
    expect(screen.getByText('Nails')).toBeInTheDocument();
  });
});

describe('ItemList pagination', () => {
  function makeItems(n: number): BinItem[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `${i + 1}`,
      name: `Item ${i + 1}`,
      quantity: null,
    }));
  }

  beforeEach(() => {
    setItemPageSize(25);
    localStorage.clear();
  });

  it('renders only pageSize items on the first page', () => {
    render(<ItemList items={makeItems(30)} readOnly />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 25')).toBeInTheDocument();
    expect(screen.queryByText('Item 26')).not.toBeInTheDocument();
  });

  it('hides the pager on single-page lists', () => {
    render(<ItemList items={makeItems(5)} readOnly />);
    expect(screen.queryByLabelText('Pagination')).not.toBeInTheDocument();
  });

  it('does not render an inline size picker (that now lives in Settings)', () => {
    render(<ItemList items={makeItems(30)} readOnly />);
    expect(screen.queryByLabelText('Items per page')).not.toBeInTheDocument();
  });

  it('clicking page 2 shows that page slice', () => {
    render(<ItemList items={makeItems(30)} readOnly />);
    fireEvent.click(screen.getByLabelText('Page 2'));
    expect(screen.queryByText('Item 25')).not.toBeInTheDocument();
    expect(screen.getByText('Item 26')).toBeInTheDocument();
    expect(screen.getByText('Item 30')).toBeInTheDocument();
  });

  it('reacts to external setItemPageSize — re-slices and resets to page 1', () => {
    render(<ItemList items={makeItems(30)} readOnly />);
    fireEvent.click(screen.getByLabelText('Page 2'));
    expect(screen.getByText('Item 26')).toBeInTheDocument();

    act(() => setItemPageSize(10));

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 10')).toBeInTheDocument();
    expect(screen.queryByText('Item 11')).not.toBeInTheDocument();
  });

  it('hides the pager when size "all" is active', () => {
    setItemPageSize('all');
    render(<ItemList items={makeItems(30)} readOnly />);
    expect(screen.queryByLabelText('Pagination')).not.toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 30')).toBeInTheDocument();
  });

  it('clicking the Name sort header resets page to 1', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={makeItems(30)} onItemsChange={onItemsChange} />);
    fireEvent.click(screen.getByLabelText('Page 2'));
    expect(screen.getByText('Item 26')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Sort by Name'));
    expect(screen.queryByText('Item 26')).not.toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('typing in the filter resets to page 1 and paginates matches', () => {
    render(<ItemList items={makeItems(30)} readOnly />);
    fireEvent.click(screen.getByLabelText('Page 2'));
    const search = screen.getByPlaceholderText('Filter items...');
    fireEvent.change(search, { target: { value: 'Item 1' } });
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 10')).toBeInTheDocument();
    expect(screen.getByText('Item 19')).toBeInTheDocument();
  });

  it('paginates in readOnly mode the same as edit mode', () => {
    render(<ItemList items={makeItems(30)} readOnly />);
    expect(screen.getByLabelText('Pagination')).toBeInTheDocument();
    expect(screen.queryByText('Item 26')).not.toBeInTheDocument();
  });

  it('adding items jumps to the new last page', () => {
    const { rerender } = render(<ItemList items={makeItems(26)} readOnly />);
    expect(screen.getByText('Item 25')).toBeInTheDocument();
    expect(screen.queryByText('Item 26')).not.toBeInTheDocument();

    rerender(<ItemList items={makeItems(27)} readOnly />);
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    expect(screen.getByText('Item 26')).toBeInTheDocument();
    expect(screen.getByText('Item 27')).toBeInTheDocument();
  });

  it('still renders nothing when hideWhenEmpty is true and list is empty', () => {
    const onItemsChange = vi.fn();
    const { container } = render(
      <ItemList items={[]} onItemsChange={onItemsChange} hideWhenEmpty />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('does not render the "Show more" collapse button anymore', () => {
    render(<ItemList items={makeItems(15)} readOnly />);
    expect(screen.queryByText(/show \d+ more/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/show less/i)).not.toBeInTheDocument();
  });
});

describe('ItemList batched delete undo', () => {
  function deleteItemAt(index: number) {
    const buttons = screen.getAllByLabelText('Item actions');
    fireEvent.click(buttons[index]);
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));
  }

  it('coalesces rapid deletes into one updating toast and a single Undo cancels them all', () => {
    const showToast = vi.fn().mockReturnValue(99);
    const updateToast = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: vi mock typing
    (useToast as any).mockReturnValue({ showToast, updateToast });

    const onItemsChange = vi.fn();
    render(<ItemList items={items} onItemsChange={onItemsChange} />);

    // Each delete removes the row from `displayItems` immediately; subsequent
    // calls always target the new first item (Hammer → Nails → Screwdriver).
    deleteItemAt(0);
    deleteItemAt(0);
    deleteItemAt(0);

    // First delete fires showToast; subsequent deletes fire updateToast on the same id.
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(updateToast).toHaveBeenCalledTimes(2);

    const lastUpdate = updateToast.mock.calls[updateToast.mock.calls.length - 1];
    expect(lastUpdate[0]).toBe(99);
    expect(lastUpdate[1].message).toBe('3 items removed');
    expect(typeof lastUpdate[1].action.onClick).toBe('function');

    // Undo: invoke the latest batch action.
    act(() => {
      lastUpdate[1].action.onClick();
    });

    // Drain pending commit timers.
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    // No deletes committed — all three were cancelled by the batch undo.
    expect(onItemsChange).not.toHaveBeenCalled();
  });
});
