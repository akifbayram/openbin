import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return { apiFetch: vi.fn(), ApiError };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ activeLocationId: 'loc-1', token: 'tok', user: { id: 'u1' } }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../useAiSettings', () => ({
  useAiSettings: () => ({ settings: { id: 's1', provider: 'openai' }, isLoading: false }),
}));

vi.mock('@/features/areas/useAreas', () => ({
  useAreaList: () => ({ areas: [], isLoading: false }),
  createArea: vi.fn(),
}));

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
    location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
    area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
  }),
}));

vi.mock('@/features/bins/useBins', () => ({
  addBin: vi.fn(),
  updateBin: vi.fn(),
  deleteBin: vi.fn(),
  restoreBin: vi.fn(),
  notifyBinsChanged: vi.fn(),
  addItemsToBin: vi.fn(),
}));

vi.mock('../PhotoBulkAdd', () => ({
  PhotoBulkAdd: ({ onClose, onBack }: { onClose: () => void; onBack: () => void }) => (
    <div data-testid="photo-bulk-add">
      <button onClick={onBack}>photo-back</button>
      <button onClick={onClose}>photo-close</button>
    </div>
  ),
}));

import { apiFetch } from '@/lib/api';
import { CommandInput } from '../CommandInput';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CommandInput', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  it('renders idle state with textarea and button', () => {
    render(<CommandInput {...defaultProps} />);

    expect(screen.getByPlaceholderText('What would you like to do?')).toBeDefined();
    expect(screen.getByText('Send')).toBeDefined();
  });

  it('button is disabled when textarea is empty', () => {
    render(<CommandInput {...defaultProps} />);

    const button = screen.getByText('Send');
    expect(button.closest('button')).toHaveProperty('disabled', true);
  });

  it('transitions to preview state on successful parsing', async () => {
    mockApiFetch.mockResolvedValue({
      actions: [
        { type: 'add_items', bin_id: 'b1', bin_name: 'Tools', items: ['Hammer'] },
      ],
      interpretation: 'Add hammer to Tools',
    });

    render(<CommandInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('What would you like to do?');
    fireEvent.change(textarea, { target: { value: 'add hammer to tools' } });

    const button = screen.getByText('Send');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Add hammer to Tools')).toBeDefined();
    });

    expect(screen.getByText(/Add Hammer to "Tools"/)).toBeDefined();
  });

  it('back button returns to idle state', async () => {
    mockApiFetch.mockResolvedValue({
      actions: [
        { type: 'add_items', bin_id: 'b1', bin_name: 'Tools', items: ['Hammer'] },
      ],
      interpretation: 'Add hammer to Tools',
    });

    render(<CommandInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('What would you like to do?');
    fireEvent.change(textarea, { target: { value: 'add hammer' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Back'));

    expect(screen.getByPlaceholderText('What would you like to do?')).toBeDefined();
  });

  it('shows error message on failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network failed'));

    render(<CommandInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('What would you like to do?');
    fireEvent.change(textarea, { target: { value: 'do something' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText("Couldn't understand that command — try rephrasing")).toBeDefined();
    });
  });

  it('falls back to inventory query when command returns zero actions', async () => {
    // First call: command returns 0 actions. Second call: query returns result.
    mockApiFetch
      .mockResolvedValueOnce({
        actions: [],
        interpretation: '',
      })
      .mockResolvedValueOnce({
        answer: 'Glass cleaner is in the Kitchen bin.',
        matches: [
          {
            bin_id: 'b-kitchen',
            name: 'Kitchen Supplies',
            area_name: 'Kitchen',
            items: ['glass cleaner', 'sponges'],
            tags: [],
            relevance: 'Contains glass cleaner',
          },
        ],
      });

    render(<CommandInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('What would you like to do?');
    fireEvent.change(textarea, { target: { value: 'where is glass cleaner?' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Glass cleaner is in the Kitchen bin.')).toBeDefined();
    });

    expect(screen.getByText('Kitchen Supplies')).toBeDefined();
    expect(screen.getByText('glass cleaner, sponges')).toBeDefined();
    expect(screen.getByText('Contains glass cleaner')).toBeDefined();
    // No Execute button in query-result state
    expect(screen.queryByText(/Execute/)).toBeNull();
  });

  it('navigates to bin on match click', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ actions: [], interpretation: '' })
      .mockResolvedValueOnce({
        answer: 'Found it in Kitchen.',
        matches: [
          {
            bin_id: 'b-kitchen',
            name: 'Kitchen Supplies',
            area_name: 'Kitchen',
            items: ['glass cleaner'],
            tags: [],
            relevance: 'Match',
          },
        ],
      });

    const onOpenChange = vi.fn();
    render(<CommandInput open={true} onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText('What would you like to do?'), {
      target: { value: 'where is glass cleaner?' },
    });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Kitchen Supplies')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Kitchen Supplies'));

    expect(mockNavigate).toHaveBeenCalledWith('/bin/b-kitchen', {
      state: { backLabel: 'Bins', backPath: '/bins' },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('back from query result returns to idle', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ actions: [], interpretation: '' })
      .mockResolvedValueOnce({
        answer: 'Found it.',
        matches: [],
      });

    render(<CommandInput {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('What would you like to do?'), {
      target: { value: 'where is the tape?' },
    });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Found it.')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Back'));

    expect(screen.getByPlaceholderText('What would you like to do?')).toBeDefined();
  });

  it('shows answer even with zero matches', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ actions: [], interpretation: '' })
      .mockResolvedValueOnce({
        answer: "I couldn't find any bins containing that item.",
        matches: [],
      });

    render(<CommandInput {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('What would you like to do?'), {
      target: { value: 'where is the unicorn?' },
    });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText("I couldn't find any bins containing that item.")).toBeDefined();
    });

    // Only Back button, no bin cards
    expect(screen.getByText('Back')).toBeDefined();
    expect(screen.queryByText(/Execute/)).toBeNull();
  });
});
