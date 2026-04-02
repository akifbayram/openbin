import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BinItem } from '@/types';
import { ItemList } from '../ItemList';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 'test' })) }));
vi.mock('@/components/ui/toast', () => ({ useToast: vi.fn(() => ({ showToast: vi.fn() })) }));
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
