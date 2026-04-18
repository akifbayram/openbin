import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('@/lib/qr', () => ({
  BIN_URL_REGEX: /\/bin\/([A-Za-z0-9]+)/,
}));

vi.mock('@/features/bins/useBins', () => ({
  lookupBinByCodeSafe: vi.fn(),
}));

vi.mock('@/features/dashboard/scanHistory', () => ({
  recordScan: vi.fn(),
}));

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin',
    Bin: 'Bin',
  }),
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    haptic: vi.fn(),
  };
});

vi.mock('@/features/bins/BinCreateDialog', () => ({
  BinCreateDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-dialog">Create Dialog</div> : null,
}));

vi.mock('@/features/qrcode/Html5QrcodePlugin', () => ({
  Html5QrcodePlugin: ({ onScanSuccess }: { onScanSuccess: (text: string) => void; paused: boolean }) => (
    <div data-testid="qr-scanner">
      <button type="button" onClick={() => onScanSuccess('https://app.openbin.app/bin/ABC123')} data-testid="scan-valid">
        Scan Valid
      </button>
      <button type="button" onClick={() => onScanSuccess('https://example.com/random')} data-testid="scan-invalid">
        Scan Invalid
      </button>
    </div>
  ),
}));

import { lookupBinByCodeSafe } from '@/features/bins/useBins';
import { ApiError, apiFetch } from '@/lib/api';
import { ScanDialog } from '../ScanDialog';

const mockApiFetch = vi.mocked(apiFetch);
const mockLookup = vi.mocked(lookupBinByCodeSafe);

const MockApiError = ApiError as unknown as new (status: number, message: string) => Error & { status: number };

function renderDialog(open = true) {
  const onOpenChange = vi.fn();
  const result = render(
    <MemoryRouter>
      <ScanDialog open={open} onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );
  return { ...result, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ScanDialog', () => {
  it('renders scanner when open', () => {
    renderDialog();
    expect(screen.getByText('Scan QR Code')).toBeTruthy();
    expect(screen.getByTestId('qr-scanner')).toBeTruthy();
  });

  it('does not render when closed', () => {
    renderDialog(false);
    expect(screen.queryByText('Scan QR Code')).toBeNull();
  });

  it('shows error for non-bin QR code', async () => {
    mockApiFetch.mockRejectedValue(new Error('fail'));
    renderDialog();

    fireEvent.click(screen.getByTestId('scan-invalid'));

    await waitFor(() => {
      expect(screen.getByText('Not a Bin QR Code')).toBeTruthy();
    });
  });

  it('shows deleted state on 410', async () => {
    mockApiFetch.mockRejectedValue(new MockApiError(410, 'Gone'));
    renderDialog();

    fireEvent.click(screen.getByTestId('scan-valid'));

    await waitFor(() => {
      expect(screen.getByText(/was deleted/)).toBeTruthy();
    });
  });

  it('shows forbidden state on 403', async () => {
    mockApiFetch.mockRejectedValue(new MockApiError(403, 'Forbidden'));
    renderDialog();

    fireEvent.click(screen.getByTestId('scan-valid'));

    await waitFor(() => {
      expect(screen.getByText(/belongs to another location/)).toBeTruthy();
    });
  });

  it('shows not-found state for unknown bin', async () => {
    mockApiFetch.mockRejectedValue(new Error('Not found'));
    renderDialog();

    fireEvent.click(screen.getByTestId('scan-valid'));

    await waitFor(() => {
      expect(screen.getByText('Bin Not Found')).toBeTruthy();
    });
  });

  it('renders manual lookup input', () => {
    renderDialog();
    expect(screen.getByText('Manual Lookup')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter bin code')).toBeTruthy();
  });

  it('manual lookup calls lookupBinByCodeSafe', async () => {
    mockLookup.mockResolvedValue({
      bin: { id: 'ABC123' } as Awaited<ReturnType<typeof lookupBinByCodeSafe>>['bin'],
      status: 'found',
    });
    renderDialog();

    const input = screen.getByPlaceholderText('Enter bin code');
    fireEvent.change(input, { target: { value: 'abc123' } });
    fireEvent.click(screen.getByText('Look Up'));

    await waitFor(() => {
      expect(mockLookup).toHaveBeenCalledWith('ABC123');
    });
  });

  it('manual lookup shows error on failure', async () => {
    mockLookup.mockResolvedValue({ bin: null, status: 'not_found' });
    renderDialog();

    const input = screen.getByPlaceholderText('Enter bin code');
    fireEvent.change(input, { target: { value: 'ZZZZZ' } });
    fireEvent.click(screen.getByText('Look Up'));

    await waitFor(() => {
      expect(screen.getByText('No bin found with that code')).toBeTruthy();
    });
  });
});
