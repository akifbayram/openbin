import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { RecoverAccountDialog } from '../RecoverAccountDialog';

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

function setupAuth(recoverImpl?: ReturnType<typeof vi.fn>) {
  const recoverAccount = recoverImpl ?? vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAuth).mockReturnValue({
    recoverAccount,
  } as unknown as ReturnType<typeof useAuth>);
  return { recoverAccount };
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof RecoverAccountDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onRecovered = vi.fn();
  const utils = render(
    <RecoverAccountDialog
      open
      onOpenChange={onOpenChange}
      email="user@example.com"
      password="hunter2"
      scheduledAt="2026-05-29T00:00:00Z"
      onRecovered={onRecovered}
      {...overrides}
    />,
  );
  return { ...utils, onOpenChange, onRecovered };
}

describe('RecoverAccountDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the formatted scheduled date', () => {
    setupAuth();
    renderDialog();
    expect(screen.getByText(/May 2[89], 2026/)).toBeTruthy();
  });

  it('Cancel closes the dialog', () => {
    setupAuth();
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Recover account calls recoverAccount with email/password and onRecovered', async () => {
    const { recoverAccount } = setupAuth();
    const { onOpenChange, onRecovered } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Recover account' }));
    await waitFor(() => {
      expect(recoverAccount).toHaveBeenCalledWith('user@example.com', 'hunter2');
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onRecovered).toHaveBeenCalled();
    });
  });

  it('shows error when recoverAccount fails', async () => {
    const recoverAccount = vi.fn().mockRejectedValue(new Error('Invalid password'));
    setupAuth(recoverAccount);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Recover account' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Invalid password');
    });
  });

  it('disables both buttons while submitting', async () => {
    let resolveRecover: () => void = () => {};
    const recoverAccount = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveRecover = resolve; }),
    );
    setupAuth(recoverAccount);
    renderDialog();
    const recoverBtn = screen.getByRole('button', { name: 'Recover account' });
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(recoverBtn);
    await waitFor(() => {
      expect((recoverBtn as HTMLButtonElement).disabled).toBe(true);
      expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);
    });
    resolveRecover();
  });
});
