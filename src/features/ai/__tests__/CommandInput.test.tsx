import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/lib/apiStream', () => ({
  apiStream: vi.fn(),
}));

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
      <button type="button" onClick={onBack}>photo-back</button>
      <button type="button" onClick={onClose}>photo-close</button>
    </div>
  ),
}));

import { apiStream } from '@/lib/apiStream';
import { CommandInput } from '../CommandInput';

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

const mockApiStream = vi.mocked(apiStream);

/** Helper to create a mock async generator that yields a done event with JSON data. */
function mockStreamDone(data: unknown) {
  return async function* () {
    yield { type: 'done' as const, text: JSON.stringify(data) };
  };
}

/** Helper to create a mock async generator that yields an error event. */
function mockStreamError(message: string, code = 'PROVIDER_ERROR') {
  return async function* () {
    yield { type: 'error' as const, message, code };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CommandInput', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  it('renders idle state with textarea and button', () => {
    renderWithChakra(<CommandInput {...defaultProps} />);

    expect(screen.getByPlaceholderText('What would you like to do?')).toBeDefined();
    expect(screen.getByText('Send')).toBeDefined();
  });

  it('button is disabled when textarea is empty', () => {
    renderWithChakra(<CommandInput {...defaultProps} />);

    const button = screen.getByText('Send');
    expect(button.closest('button')).toHaveProperty('disabled', true);
  });

  it('transitions to preview state on successful parsing', async () => {
    mockApiStream.mockReturnValue(mockStreamDone({
      actions: [
        { type: 'add_items', bin_id: 'b1', bin_name: 'Tools', items: ['Hammer'] },
      ],
      interpretation: 'Add hammer to Tools',
    })());

    renderWithChakra(<CommandInput {...defaultProps} />);

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
    mockApiStream.mockReturnValue(mockStreamDone({
      actions: [
        { type: 'add_items', bin_id: 'b1', bin_name: 'Tools', items: ['Hammer'] },
      ],
      interpretation: 'Add hammer to Tools',
    })());

    renderWithChakra(<CommandInput {...defaultProps} />);

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
    mockApiStream.mockReturnValue(mockStreamError("Couldn't understand that command")());

    renderWithChakra(<CommandInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('What would you like to do?');
    fireEvent.change(textarea, { target: { value: 'do something' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText("Couldn't understand that command")).toBeDefined();
    });
  });

  it('shows query result when AI returns answer instead of actions', async () => {
    // Unified endpoint returns a query-style response for questions
    mockApiStream.mockReturnValue(mockStreamDone({
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
    })());

    renderWithChakra(<CommandInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('What would you like to do?');
    fireEvent.change(textarea, { target: { value: 'where is glass cleaner?' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Glass cleaner is in the Kitchen bin.')).toBeDefined();
    });

    expect(screen.getByText('Kitchen Supplies')).toBeDefined();
    expect(screen.getByText('glass cleaner, sponges')).toBeDefined();
    // Relevance is not shown to the user
    // No Execute button in query-result state
    expect(screen.queryByText(/Execute/)).toBeNull();
  });

  it('navigates to bin on match click', async () => {
    mockApiStream.mockReturnValue(mockStreamDone({
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
    })());

    const onOpenChange = vi.fn();
    renderWithChakra(<CommandInput open={true} onOpenChange={onOpenChange} />);

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
    mockApiStream.mockReturnValue(mockStreamDone({
      answer: 'Found it.',
      matches: [],
    })());

    renderWithChakra(<CommandInput {...defaultProps} />);

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
    mockApiStream.mockReturnValue(mockStreamDone({
      answer: "I couldn't find any bins containing that item.",
      matches: [],
    })());

    renderWithChakra(<CommandInput {...defaultProps} />);

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
