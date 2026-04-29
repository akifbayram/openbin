import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DowngradeImpactDialog } from '../DowngradeImpactDialog';
import { FIXTURE_IMPACT_FREE } from './fixtures/downgradeImpact';

const submitCheckoutAction = vi.fn();

vi.mock('@/lib/checkoutAction', () => ({
  submitCheckoutAction: (...args: unknown[]) => submitCheckoutAction(...args),
}));

let downgradeResponse: unknown = { ok: true };

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    if (url === '/api/plan/downgrade-impact') return FIXTURE_IMPACT_FREE;
    if (url === '/api/plan/downgrade') return downgradeResponse;
    throw new Error(`Unexpected URL: ${url}`);
  }),
}));

describe('DowngradeImpactDialog', () => {
  it('does not render content when closed', () => {
    render(<DowngradeImpactDialog open={false} onOpenChange={() => {}} targetPlan="free" onConfirmed={() => {}} />);
    expect(screen.queryByText(/Switch to Free/i)).toBeNull();
  });

  it('renders warnings after fetch', async () => {
    render(<DowngradeImpactDialog open={true} onOpenChange={() => {}} targetPlan="free" onConfirmed={() => {}} />);
    await waitFor(() => expect(screen.getByText(/47 bins/)).toBeInTheDocument());
    expect(screen.getByText(/AI features/)).toBeInTheDocument();
  });

  it('calls onConfirmed and closes when downgrade completes directly (lapsed path)', async () => {
    downgradeResponse = { ok: true };
    submitCheckoutAction.mockReset();
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    render(<DowngradeImpactDialog open={true} onOpenChange={onOpenChange} targetPlan="free" onConfirmed={onConfirmed} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Cancel subscription/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Cancel subscription/i }));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(submitCheckoutAction).not.toHaveBeenCalled();
  });

  it('redirects via submitCheckoutAction and keeps dialog open when active-paid', async () => {
    downgradeResponse = {
      portalFlowAction: {
        url: 'https://billing.example.com/portal-flow',
        method: 'POST',
        fields: { token: 'jwt', targetPlan: 'free' },
      },
    };
    submitCheckoutAction.mockReset();
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    render(<DowngradeImpactDialog open={true} onOpenChange={onOpenChange} targetPlan="free" onConfirmed={onConfirmed} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Cancel subscription/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Cancel subscription/i }));
    await waitFor(() => expect(submitCheckoutAction).toHaveBeenCalled());
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('uses "Change plan" copy when targeting plus', async () => {
    downgradeResponse = { ok: true };
    render(<DowngradeImpactDialog open={true} onOpenChange={() => {}} targetPlan="plus" onConfirmed={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Change plan/i })).toBeInTheDocument());
  });
});
