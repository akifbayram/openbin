import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BinItem } from '@/types';
import { ItemList } from '../ItemList';
import { setItemPageSize } from '../useItemPageSize';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 'test' })) }));
vi.mock('@/components/ui/toast', () => ({ useToast: vi.fn(() => ({ showToast: vi.fn() })) }));
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

  it('calls onItemsChange (not server API) when item is deleted', () => {
    const onItemsChange = vi.fn();
    render(<ItemList items={items} onItemsChange={onItemsChange} />);

    const removeButtons = screen.getAllByLabelText('Remove item');
    fireEvent.click(removeButtons[0]); // delete Hammer

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
