import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/usePlan';
import { DeleteAccountDialog } from '../DeleteAccountDialog';

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/usePlan', () => ({
  usePlan: vi.fn(),
}));

const exportZipMock = vi.fn();
vi.mock('../../exportImport', () => ({
  exportZip: (...args: unknown[]) => exportZipMock(...args),
}));

const showToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast }),
}));

interface AuthOverrides {
  hasPassword?: boolean;
  plan?: 'free' | 'plus' | 'pro';
  subscriptionStatus?: 'active' | 'trial' | 'inactive';
  email?: string;
}

function setupAuth(overrides: AuthOverrides = {}, deleteImpl?: ReturnType<typeof vi.fn>) {
  const deleteAccount = deleteImpl ?? vi.fn().mockResolvedValue({ scheduledAt: '2026-05-29T00:00:00Z' });
  vi.mocked(useAuth).mockReturnValue({
    user: {
      id: '1',
      displayName: 'Test User',
      email: overrides.email ?? 'test@example.com',
      avatarUrl: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      hasPassword: overrides.hasPassword ?? true,
      plan: overrides.plan ?? 'free',
      subscriptionStatus: overrides.subscriptionStatus ?? 'inactive',
    },
    deleteAccount,
    activeLocationId: 'loc-1',
  } as unknown as ReturnType<typeof useAuth>);
  return { deleteAccount };
}

function setupPlan(opts: { selfHosted?: boolean; billingPeriod?: 'quarterly' | 'annual' | null } = {}) {
  vi.mocked(usePlan).mockReturnValue({
    isSelfHosted: opts.selfHosted ?? false,
    planInfo: {
      plan: 'pro',
      status: 'active',
      billingPeriod: opts.billingPeriod ?? 'quarterly',
      portalAction: null,
    },
  } as unknown as ReturnType<typeof usePlan>);
}

function renderDialog() {
  const onOpenChange = vi.fn();
  const utils = render(<DeleteAccountDialog open onOpenChange={onOpenChange} />);
  return { ...utils, onOpenChange };
}

describe('DeleteAccountDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportZipMock.mockReset();
    exportZipMock.mockResolvedValue(undefined);
  });

  it('Step A renders user email and 30 days copy', () => {
    setupAuth({ email: 'jane@example.com' });
    setupPlan();
    renderDialog();
    expect(screen.getByText('jane@example.com')).toBeTruthy();
    expect(screen.getByText(/30 days/)).toBeTruthy();
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
  });

  it('skips subscription step for free users (A -> C)', () => {
    setupAuth({ plan: 'free' });
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Confirm Account Deletion')).toBeTruthy();
    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
  });

  it('skips subscription step on self-hosted even with active sub', () => {
    setupAuth({ plan: 'pro', subscriptionStatus: 'active' });
    setupPlan({ selfHosted: true });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Confirm Account Deletion')).toBeTruthy();
  });

  it('shows subscription step for active Pro sub on cloud', () => {
    setupAuth({ plan: 'pro', subscriptionStatus: 'active' });
    setupPlan({ billingPeriod: 'annual' });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Cancel Subscription')).toBeTruthy();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.getByText(/annual/)).toBeTruthy();
    expect(screen.getByText('Cancel and stop billing now')).toBeTruthy();
    expect(screen.getByText('Cancel and refund the unused time')).toBeTruthy();
  });

  it('disables Delete button until type-to-confirm matches exactly', () => {
    setupAuth({ hasPassword: false, plan: 'free' });
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const deleteBtn = screen.getByRole('button', { name: 'Delete Account' });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);
    const input = screen.getByLabelText(/Type/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'wrong text' } });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'delete my account' } });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('requires password for password users', () => {
    setupAuth({ hasPassword: true, plan: 'free' });
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const deleteBtn = screen.getByRole('button', { name: 'Delete Account' });
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: 'delete my account' } });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Enter your password'), { target: { value: 'pw' } });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('OAuth-only user has no password field', () => {
    setupAuth({ hasPassword: false, plan: 'free' });
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByLabelText('Enter your password')).toBeNull();
  });

  it('calls deleteAccount with password and refundPolicy on submit', async () => {
    const deleteAccount = vi.fn().mockResolvedValue({ scheduledAt: '2026-05-29T00:00:00Z' });
    setupAuth({ hasPassword: true, plan: 'pro', subscriptionStatus: 'active' }, deleteAccount);
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByText('Cancel and refund the unused time'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: 'delete my account' } });
    fireEvent.change(screen.getByLabelText('Enter your password'), { target: { value: 'mypass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledWith('mypass', 'prorated');
    });
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });
  });

  it('passes undefined password for OAuth-only users', async () => {
    const deleteAccount = vi.fn().mockResolvedValue({ scheduledAt: null });
    setupAuth({ hasPassword: false, plan: 'free' }, deleteAccount);
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: 'delete my account' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledWith(undefined, 'none');
    });
  });

  it('shows error alert on submit failure', async () => {
    const deleteAccount = vi.fn().mockRejectedValue(new Error('Cannot delete: you are sole admin of a shared location'));
    setupAuth({ hasPassword: false, plan: 'free' }, deleteAccount);
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: 'delete my account' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByRole('alert').textContent).toContain('sole admin');
  });

  it('shows Download my data button on Step A', () => {
    setupAuth({ plan: 'free' });
    setupPlan();
    renderDialog();
    expect(screen.getByRole('button', { name: /Download my data first/ })).toBeTruthy();
  });

  it('clicking Download my data calls exportZip with active location', async () => {
    setupAuth({ plan: 'free' });
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Download my data first/ }));
    await waitFor(() => {
      expect(exportZipMock).toHaveBeenCalledWith('loc-1');
    });
  });

  it('shows loading state during export', async () => {
    let resolveExport: () => void = () => {};
    exportZipMock.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveExport = resolve;
      }),
    );
    setupAuth({ plan: 'free' });
    setupPlan();
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Download my data first/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Downloading/ })).toBeTruthy();
    });
    resolveExport();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download my data first/ })).toBeTruthy();
    });
  });

  it('hides Download my data button on Steps B and C', () => {
    setupAuth({ plan: 'pro', subscriptionStatus: 'active' });
    setupPlan();
    renderDialog();
    // Step A -> B (subscription)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('button', { name: /Download my data first/ })).toBeNull();
    // Step B -> C (confirm)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('button', { name: /Download my data first/ })).toBeNull();
  });
});
