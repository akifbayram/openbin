import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
const mockAsk = vi.fn();
const mockCancelAsk = vi.fn();
const mockClearAsk = vi.fn();

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

vi.mock('@/lib/usePermissions', () => ({
  usePermissions: () => ({ canWrite: true }),
}));

vi.mock('@/features/items/itemActions', () => ({
  checkoutItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  removeItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  renameItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  updateQuantitySafe: vi.fn().mockResolvedValue({ ok: true, quantity: null }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../useAiSettings', () => ({
  useAiSettings: () => ({
    settings: { id: 's1', provider: 'openai', apiKey: 'k', model: 'gpt-4o', endpointUrl: null },
    isLoading: false,
  }),
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
  useBinList: () => ({ bins: [], isLoading: false, refresh: vi.fn() }),
}));

vi.mock('@/features/capture/capturedPhotos', () => ({
  takeCapturedPhotos: () => ({ files: [], groups: null }),
}));

vi.mock('@/lib/audioRecorder', () => ({
  isRecordingSupported: () => false,
  startRecording: vi.fn(),
}));

vi.mock('@/lib/useTranscription', () => ({
  useTranscription: () => ({
    state: 'idle',
    duration: 0,
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock('../PhotoBulkAdd', () => ({
  PhotoBulkAdd: () => <div data-testid="photo-bulk-add" />,
}));

vi.mock('../useStreamingAsk', async () => {
  const actual = await vi.importActual<typeof import('../useStreamingAsk')>('../useStreamingAsk');
  return {
    ...actual,
    useStreamingAsk: () => ({
      classified: null,
      isStreaming: false,
      error: null,
      ask: mockAsk,
      cancel: mockCancelAsk,
      clear: mockClearAsk,
    }),
  };
});

vi.mock('../useActionExecutor', async (importActual) => {
  const actual = await importActual<typeof import('../useActionExecutor')>();
  return {
    ...actual,
    executeBatch: vi.fn(),
  };
});

import { AskPage } from '../AskPage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AskPage (mobile chat shell)', () => {
  function getComposer() {
    return screen.getByRole('textbox', { name: 'Ask AI' }) as HTMLTextAreaElement;
  }

  it('renders a "New chat" button only after the conversation has turns', async () => {
    mockAsk.mockResolvedValue({ answer: 'Found it.', matches: [] });
    render(<AskPage />);

    expect(screen.queryByLabelText('New chat')).toBeNull();

    fireEvent.change(getComposer(), { target: { value: 'where is the tape?' } });
    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Found it.')).toBeDefined();
    });

    expect(screen.getByLabelText('New chat')).toBeDefined();
  });

  it('clicking "New chat" abandons the current chat and restores the empty state', async () => {
    mockAsk.mockResolvedValue({ answer: 'Found it.', matches: [] });
    render(<AskPage />);

    fireEvent.change(getComposer(), { target: { value: 'where is the tape?' } });
    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Found it.')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('New chat'));

    expect(screen.queryByText('Found it.')).toBeNull();
    expect(screen.getByText(/Where is the cordless drill/)).toBeDefined();
    expect(screen.queryByLabelText('New chat')).toBeNull();
  });

  it('clicking "New chat" while a request is in flight aborts the stream and clears the thread', async () => {
    let resolveAsk: ((v: unknown) => void) | null = null;
    mockAsk.mockImplementationOnce(
      () => new Promise((res) => { resolveAsk = res; }),
    );

    render(<AskPage />);

    fireEvent.change(getComposer(), { target: { value: 'slow query' } });
    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(screen.getByLabelText('New chat')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('New chat'));

    expect(mockCancelAsk).toHaveBeenCalled();
    expect(screen.getByText(/Where is the cordless drill/)).toBeDefined();
    expect(screen.queryByLabelText('New chat')).toBeNull();

    if (resolveAsk) (resolveAsk as (v: unknown) => void)({ answer: 'late', matches: [] });
  });
});
