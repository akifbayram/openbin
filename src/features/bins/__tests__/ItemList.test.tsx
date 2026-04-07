import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BinItem } from '@/types';
import { ItemList } from '../ItemList';

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

describe('ItemList collapsible', () => {
  it('does not render a collapse toggle when collapsible is not set', () => {
    render(<ItemList items={items} readOnly />);
    expect(screen.queryByLabelText(/toggle items/i)).not.toBeInTheDocument();
  });

  it('renders a collapse toggle when collapsible is true', () => {
    render(<ItemList items={items} readOnly collapsible />);
    expect(screen.getByLabelText(/toggle items/i)).toBeInTheDocument();
  });

  it('shows items by default when collapsible is true', () => {
    render(<ItemList items={items} readOnly collapsible />);
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    expect(screen.getByText('Nails')).toBeInTheDocument();
  });

  it('hides items when the toggle is clicked', () => {
    render(<ItemList items={items} readOnly collapsible />);
    fireEvent.click(screen.getByLabelText(/toggle items/i));
    expect(screen.queryByText('Hammer')).not.toBeInTheDocument();
    expect(screen.queryByText('Nails')).not.toBeInTheDocument();
    // Header with count still visible
    expect(screen.getByText('3 Items')).toBeInTheDocument();
  });

  it('shows items again when the toggle is clicked twice', () => {
    render(<ItemList items={items} readOnly collapsible />);
    fireEvent.click(screen.getByLabelText(/toggle items/i));
    fireEvent.click(screen.getByLabelText(/toggle items/i));
    expect(screen.getByText('Hammer')).toBeInTheDocument();
  });

  it('persists collapsed state to localStorage keyed by binId', () => {
    render(<ItemList items={items} binId="bin-42" readOnly collapsible />);
    fireEvent.click(screen.getByLabelText(/toggle items/i));
    expect(localStorage.getItem('openbin-items-collapsed-bin-42')).toBe('true');
  });

  it('restores collapsed state from localStorage on mount', () => {
    localStorage.setItem('openbin-items-collapsed-bin-42', 'true');
    render(<ItemList items={items} binId="bin-42" readOnly collapsible />);
    expect(screen.queryByText('Hammer')).not.toBeInTheDocument();
    expect(screen.getByText('3 Items')).toBeInTheDocument();
  });

  it('clears localStorage when expanded', () => {
    localStorage.setItem('openbin-items-collapsed-bin-42', 'true');
    render(<ItemList items={items} binId="bin-42" readOnly collapsible />);
    fireEvent.click(screen.getByLabelText(/toggle items/i));
    expect(localStorage.getItem('openbin-items-collapsed-bin-42')).toBeNull();
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
