import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemSelectionBar } from '../ItemSelectionBar';

describe('ItemSelectionBar', () => {
  it('renders nothing when selectionCount is 0', () => {
    const { container } = render(
      <ItemSelectionBar selectionCount={0} onCheckout={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders count and buttons when selectionCount > 0', () => {
    render(
      <ItemSelectionBar selectionCount={3} onCheckout={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.getByText(/3 items selected/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /checkout/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /remove/i })).toBeDefined();
  });

  it('singular "item" when count is 1', () => {
    render(
      <ItemSelectionBar selectionCount={1} onCheckout={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.getByText(/1 item selected/i)).toBeDefined();
  });

  it('invokes onCheckout when Checkout is clicked', () => {
    const onCheckout = vi.fn();
    render(
      <ItemSelectionBar selectionCount={2} onCheckout={onCheckout} onRemove={vi.fn()} onClear={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /checkout/i }));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('invokes onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(
      <ItemSelectionBar selectionCount={2} onCheckout={vi.fn()} onRemove={vi.fn()} onClear={onClear} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('respects isBusy prop disabling action buttons', () => {
    render(
      <ItemSelectionBar selectionCount={2} onCheckout={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} isBusy />,
    );
    expect((screen.getByRole('button', { name: /checkout/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /remove/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
