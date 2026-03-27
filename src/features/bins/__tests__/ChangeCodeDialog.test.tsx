import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('ChangeCodeDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders adopt mode title', () => {
    render(
      <MemoryRouter>
        <ChangeCodeDialog
          open={true}
          onOpenChange={() => {}}
          mode="adopt"
          currentBin={{ id: 'ABCDEF', name: 'My Bin' }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Change Code')).toBeTruthy();
  });

  it('renders reassign mode title', () => {
    render(
      <MemoryRouter>
        <ChangeCodeDialog
          open={true}
          onOpenChange={() => {}}
          mode="reassign"
          currentBin={{ id: 'ABCDEF', name: 'My Bin' }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Reassign Code')).toBeTruthy();
  });

  it('auto-uppercases manual input', () => {
    render(
      <MemoryRouter>
        <ChangeCodeDialog
          open={true}
          onOpenChange={() => {}}
          mode="adopt"
          currentBin={{ id: 'ABCDEF', name: 'My Bin' }}
        />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('Enter code...');
    fireEvent.change(input, { target: { value: 'abcxyz' } });
    expect((input as HTMLInputElement).value).toBe('ABCXYZ');
  });

  it('disables lookup button for invalid codes', () => {
    render(
      <MemoryRouter>
        <ChangeCodeDialog
          open={true}
          onOpenChange={() => {}}
          mode="adopt"
          currentBin={{ id: 'ABCDEF', name: 'My Bin' }}
        />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('Enter code...');
    fireEvent.change(input, { target: { value: 'AB' } });
    const btn = screen.getByRole('button', { name: /look up/i });
    expect(btn).toBeDisabled();
  });
});
