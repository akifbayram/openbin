import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BulkAddHint } from '../BulkAddHint';

describe('BulkAddHint', () => {
  it('announces politely via role=status with aria-live=polite', () => {
    render(<BulkAddHint photoCount={3} onSwitch={vi.fn()} onDismiss={vi.fn()} />);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('surfaces a primary "Use Bulk Add" call-to-action', () => {
    render(<BulkAddHint photoCount={3} onSwitch={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /use bulk add/i })).toBeTruthy();
  });

  it('invokes onSwitch when the CTA is clicked', () => {
    const onSwitch = vi.fn();
    render(<BulkAddHint photoCount={3} onSwitch={onSwitch} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /use bulk add/i }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('renders a labeled dismiss control distinct from the CTA', () => {
    render(<BulkAddHint photoCount={3} onSwitch={vi.fn()} onDismiss={vi.fn()} />);
    const dismiss = screen.getByRole('button', { name: /dismiss/i });
    const cta = screen.getByRole('button', { name: /use bulk add/i });
    expect(dismiss).not.toBe(cta);
  });

  it('invokes onDismiss without invoking onSwitch when the dismiss control is clicked', () => {
    const onSwitch = vi.fn();
    const onDismiss = vi.fn();
    render(<BulkAddHint photoCount={3} onSwitch={onSwitch} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSwitch).not.toHaveBeenCalled();
  });
});
