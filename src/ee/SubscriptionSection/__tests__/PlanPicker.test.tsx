import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanPicker } from '../PlanPicker';
import { FIXTURE_CATALOG } from './fixtures/planCatalog';

const POST_ACTION = { url: 'https://billing.openbin.app/subscribe', method: 'POST' as const, fields: { token: 't' } };

describe('PlanPicker', () => {
  it('renders Plus + Pro cards for a Free user', () => {
    render(
      <PlanPicker
        catalog={FIXTURE_CATALOG}
        currentPlan="free"
        billingPeriod="quarterly"
        onBillingPeriodChange={() => {}}
        actions={{ plus: POST_ACTION, pro: POST_ACTION }}
      />,
    );
    expect(screen.getByText('Plus')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    // Two CTAs (one per card; Plus has 'Subscribe', Pro has 'Subscribe')
    expect(screen.getAllByText(/Subscribe/i).length).toBeGreaterThanOrEqual(2);
  });

  it('omits Free from the picker', () => {
    render(
      <PlanPicker
        catalog={FIXTURE_CATALOG}
        currentPlan="free"
        billingPeriod="quarterly"
        onBillingPeriodChange={() => {}}
        actions={{ plus: POST_ACTION, pro: POST_ACTION }}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Free' })).toBeNull();
  });

  it('switches quarterly/annual via toggle', () => {
    const onChange = vi.fn();
    render(
      <PlanPicker
        catalog={FIXTURE_CATALOG}
        currentPlan="free"
        billingPeriod="quarterly"
        onBillingPeriodChange={onChange}
        actions={{ plus: POST_ACTION, pro: POST_ACTION }}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /annual/i }));
    expect(onChange).toHaveBeenCalledWith('annual');
  });

  it('shows annual context when billingPeriod=annual', () => {
    render(
      <PlanPicker
        catalog={FIXTURE_CATALOG}
        currentPlan="free"
        billingPeriod="annual"
        onBillingPeriodChange={() => {}}
        actions={{ plus: POST_ACTION, pro: POST_ACTION }}
      />,
    );
    expect(screen.getAllByText(/billed yearly/i).length).toBeGreaterThan(0);
  });
});
