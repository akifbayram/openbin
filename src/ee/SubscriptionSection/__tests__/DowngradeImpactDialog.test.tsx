import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DowngradeImpactDialog } from '../DowngradeImpactDialog';
import { FIXTURE_IMPACT_FREE } from './fixtures/downgradeImpact';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    if (url === '/api/plan/downgrade-impact') return FIXTURE_IMPACT_FREE;
    if (url === '/api/plan/downgrade') return { ok: true };
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

  it('calls onConfirmed and closes after successful confirm', async () => {
    const onConfirmed = vi.fn();
    const onOpenChange = vi.fn();
    render(<DowngradeImpactDialog open={true} onOpenChange={onOpenChange} targetPlan="free" onConfirmed={onConfirmed} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Switch to Free/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Switch to Free/i }));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
