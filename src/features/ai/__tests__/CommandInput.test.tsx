import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

vi.mock('@/features/bins/useBins', () => ({
  addBin: vi.fn(),
  updateBin: vi.fn(),
  deleteBin: vi.fn(),
  restoreBin: vi.fn(),
  notifyBinsChanged: vi.fn(),
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
    expect(screen.getByText('Run Command')).toBeDefined();
  });

  it('button is disabled when textarea is empty', () => {
    render(<CommandInput {...defaultProps} />);

    const button = screen.getByText('Run Command');
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

    const button = screen.getByText('Run Command');
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
    fireEvent.click(screen.getByText('Run Command'));

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
    fireEvent.click(screen.getByText('Run Command'));

    await waitFor(() => {
      expect(screen.getByText('Failed to parse command')).toBeDefined();
    });
  });

  it('shows empty actions message when no actions returned', async () => {
    mockApiFetch.mockResolvedValue({
      actions: [],
      interpretation: 'Could not understand the command',
    });

    render(<CommandInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('What would you like to do?');
    fireEvent.change(textarea, { target: { value: 'asdfgh' } });
    fireEvent.click(screen.getByText('Run Command'));

    await waitFor(() => {
      expect(screen.getByText(/No actions could be determined/)).toBeDefined();
    });
  });
});
