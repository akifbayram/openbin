import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeCodeDialog } from '../ChangeCodeDialog';

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

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ activeLocationId: 'loc1', token: 'test-token', user: { id: 'u1' } }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe('ChangeCodeDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders with Change Code title', () => {
    render(
      <ChangeCodeDialog
        open={true}
        onOpenChange={() => {}}
        currentBin={{ id: 'uuid-1', short_code: 'ABCDEF', name: 'My Bin' }}
      />
    );
    expect(screen.getByText('Change Code')).toBeTruthy();
  });

  it('auto-uppercases manual input', () => {
    render(
      <ChangeCodeDialog
        open={true}
        onOpenChange={() => {}}
        currentBin={{ id: 'uuid-1', short_code: 'ABCDEF', name: 'My Bin' }}
      />
    );
    const input = screen.getByPlaceholderText('Enter code...');
    fireEvent.change(input, { target: { value: 'abcxyz' } });
    expect((input as HTMLInputElement).value).toBe('ABCXYZ');
  });

  it('disables lookup button for invalid codes', () => {
    render(
      <ChangeCodeDialog
        open={true}
        onOpenChange={() => {}}
        currentBin={{ id: 'uuid-1', short_code: 'ABCDEF', name: 'My Bin' }}
      />
    );
    const input = screen.getByPlaceholderText('Enter code...');
    fireEvent.change(input, { target: { value: 'AB' } });
    const btn = screen.getByRole('button', { name: /look up/i });
    expect(btn).toBeDisabled();
  });

  it('shows same-code warning when entering current short_code', () => {
    render(
      <ChangeCodeDialog
        open={true}
        onOpenChange={() => {}}
        currentBin={{ id: 'uuid-1', short_code: 'ABCDEF', name: 'My Bin' }}
      />
    );
    const input = screen.getByPlaceholderText('Enter code...');
    fireEvent.change(input, { target: { value: 'ABCDEF' } });
    expect(screen.getByText("This is already this bin's code.")).toBeTruthy();
  });
});
