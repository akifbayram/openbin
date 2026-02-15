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

import { apiFetch } from '@/lib/api';
import { DictationInput } from '../DictationInput';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DictationInput', () => {
  const defaultProps = {
    onItemsConfirmed: vi.fn(),
    onClose: vi.fn(),
    aiConfigured: true,
    onAiSetupNeeded: vi.fn(),
  };

  it('renders idle state with textarea and button', () => {
    render(<DictationInput {...defaultProps} />);

    expect(screen.getByPlaceholderText('Describe the items in this bin...')).toBeDefined();
    expect(screen.getByText('Add Items')).toBeDefined();
  });

  it('button is disabled when textarea is empty', () => {
    render(<DictationInput {...defaultProps} />);

    const button = screen.getByText('Add Items');
    expect(button.closest('button')).toHaveProperty('disabled', true);
  });

  it('calls onAiSetupNeeded when AI is not configured', async () => {
    const onAiSetupNeeded = vi.fn();
    render(<DictationInput {...defaultProps} aiConfigured={false} onAiSetupNeeded={onAiSetupNeeded} />);

    const textarea = screen.getByPlaceholderText('Describe the items in this bin...');
    fireEvent.change(textarea, { target: { value: 'some items' } });

    const button = screen.getByText('Add Items');
    fireEvent.click(button);

    expect(onAiSetupNeeded).toHaveBeenCalled();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('transitions to preview state on successful structuring', async () => {
    mockApiFetch.mockResolvedValue({ items: ['Hammer', 'Nails (x10)'] });

    render(<DictationInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Describe the items in this bin...');
    fireEvent.change(textarea, { target: { value: 'a hammer and ten nails' } });

    const button = screen.getByText('Add Items');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('2 items found')).toBeDefined();
    });

    expect(screen.getByText('Hammer')).toBeDefined();
    expect(screen.getByText('Nails (x10)')).toBeDefined();
  });

  it('confirms selected items', async () => {
    const onItemsConfirmed = vi.fn();
    mockApiFetch.mockResolvedValue({ items: ['Item A', 'Item B'] });

    render(<DictationInput {...defaultProps} onItemsConfirmed={onItemsConfirmed} />);

    const textarea = screen.getByPlaceholderText('Describe the items in this bin...');
    fireEvent.change(textarea, { target: { value: 'items' } });
    fireEvent.click(screen.getByText('Add Items'));

    await waitFor(() => {
      expect(screen.getByText('2 items found')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Add 2 Items'));

    expect(onItemsConfirmed).toHaveBeenCalledWith(['Item A', 'Item B']);
  });

  it('back button returns to idle state', async () => {
    mockApiFetch.mockResolvedValue({ items: ['Item'] });

    render(<DictationInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Describe the items in this bin...');
    fireEvent.change(textarea, { target: { value: 'an item' } });
    fireEvent.click(screen.getByText('Add Items'));

    await waitFor(() => {
      expect(screen.getByText('1 item found')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Back'));

    expect(screen.getByPlaceholderText('Describe the items in this bin...')).toBeDefined();
  });

  it('shows error message on failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network failed'));

    render(<DictationInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Describe the items in this bin...');
    fireEvent.change(textarea, { target: { value: 'stuff' } });
    fireEvent.click(screen.getByText('Add Items'));

    await waitFor(() => {
      expect(screen.getByText('Failed to structure text')).toBeDefined();
    });
  });
});
