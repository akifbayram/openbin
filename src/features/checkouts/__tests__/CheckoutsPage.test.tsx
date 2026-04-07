import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemCheckoutWithContext } from '@/types';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 'test' })),
}));
vi.mock('@/components/ui/toast', () => ({
  useToast: vi.fn(() => ({ showToast: vi.fn() })),
}));
vi.mock('@/lib/usePermissions', () => ({
  usePermissions: vi.fn(() => ({ canWrite: true })),
}));
vi.mock('../useCheckouts', () => ({
  useLocationCheckouts: vi.fn(() => ({ checkouts: [], isLoading: false })),
  returnItem: vi.fn().mockResolvedValue(undefined),
}));

import { CheckoutsPage } from '../CheckoutsPage';
import { useLocationCheckouts } from '../useCheckouts';

const mockUseLocationCheckouts = vi.mocked(useLocationCheckouts);

function renderPage() {
  return render(
    <MemoryRouter>
      <CheckoutsPage />
    </MemoryRouter>,
  );
}

const now = new Date().toISOString();

const sampleCheckouts: ItemCheckoutWithContext[] = [
  {
    id: 'co-1',
    item_id: 'item-1',
    item_name: 'Hammer',
    origin_bin_id: 'bin-1',
    origin_bin_name: 'Tool Box',
    location_id: 'loc-1',
    checked_out_by: 'user-1',
    checked_out_by_name: 'Alice',
    checked_out_at: now,
    returned_at: null,
    returned_by: null,
    return_bin_id: null,
  },
  {
    id: 'co-2',
    item_id: 'item-2',
    item_name: 'Wrench',
    origin_bin_id: 'bin-2',
    origin_bin_name: 'Garage Shelf',
    location_id: 'loc-1',
    checked_out_by: 'user-2',
    checked_out_by_name: 'Bob',
    checked_out_at: now,
    returned_at: null,
    returned_by: null,
    return_bin_id: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLocationCheckouts.mockReturnValue({ checkouts: [], isLoading: false });
});

describe('CheckoutsPage', () => {
  it('renders empty state when no checkouts', () => {
    renderPage();
    expect(screen.getByText('No items checked out')).toBeInTheDocument();
    expect(screen.getByText('Items you check out from bins will appear here')).toBeInTheDocument();
  });

  it('renders checkout list with item, bin, and user names', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: sampleCheckouts, isLoading: false });
    renderPage();

    expect(screen.getByText('Hammer')).toBeInTheDocument();
    expect(screen.getByText('Tool Box')).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();

    expect(screen.getByText('Wrench')).toBeInTheDocument();
    expect(screen.getByText('Garage Shelf')).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it('shows count of checked out items', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: sampleCheckouts, isLoading: false });
    renderPage();
    expect(screen.getByText('2 items checked out')).toBeInTheDocument();
  });

  it('filters checkouts by item name', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: sampleCheckouts, isLoading: false });
    renderPage();

    const searchInput = screen.getByPlaceholderText('Search items, bins, people...');
    fireEvent.change(searchInput, { target: { value: 'Hammer' } });

    expect(screen.getByText('Hammer')).toBeInTheDocument();
    expect(screen.queryByText('Wrench')).not.toBeInTheDocument();
  });

  it('filters checkouts by bin name', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: sampleCheckouts, isLoading: false });
    renderPage();

    const searchInput = screen.getByPlaceholderText('Search items, bins, people...');
    fireEvent.change(searchInput, { target: { value: 'Garage' } });

    expect(screen.getByText('Wrench')).toBeInTheDocument();
    expect(screen.queryByText('Hammer')).not.toBeInTheDocument();
  });

  it('filters checkouts by user name', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: sampleCheckouts, isLoading: false });
    renderPage();

    const searchInput = screen.getByPlaceholderText('Search items, bins, people...');
    fireEvent.change(searchInput, { target: { value: 'Bob' } });

    expect(screen.getByText('Wrench')).toBeInTheDocument();
    expect(screen.queryByText('Hammer')).not.toBeInTheDocument();
  });

  it('shows no-matches empty state when search has no results', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: sampleCheckouts, isLoading: false });
    renderPage();

    const searchInput = screen.getByPlaceholderText('Search items, bins, people...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.getByText('Try a different search')).toBeInTheDocument();
  });

  it('renders return buttons when user canWrite', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: sampleCheckouts, isLoading: false });
    renderPage();

    expect(screen.getByLabelText('Return Hammer')).toBeInTheDocument();
    expect(screen.getByLabelText('Return Wrench')).toBeInTheDocument();
  });

  it('hides return buttons when user cannot write', async () => {
    const { usePermissions } = await import('@/lib/usePermissions');
    vi.mocked(usePermissions).mockReturnValue({ canWrite: false } as ReturnType<typeof usePermissions>);
    mockUseLocationCheckouts.mockReturnValue({ checkouts: sampleCheckouts, isLoading: false });
    renderPage();

    expect(screen.queryByLabelText('Return Hammer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Return Wrench')).not.toBeInTheDocument();

    // Restore default
    vi.mocked(usePermissions).mockReturnValue({ canWrite: true } as ReturnType<typeof usePermissions>);
  });
});
