import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemActionMenu } from '../ItemActionMenu';

describe('ItemActionMenu', () => {
  const defaults = {
    onOpenBin: vi.fn(),
    onCheckout: vi.fn(),
    onAdjustQuantity: vi.fn(),
    onRename: vi.fn(),
    onRemove: vi.fn(),
    canWrite: true,
    isTrashed: false,
  };

  it('is closed by default', () => {
    render(<ItemActionMenu {...defaults} />);
    expect(screen.queryByText('Checkout')).toBeNull();
  });

  it('opens on trigger click and shows all 5 actions when canWrite', () => {
    render(<ItemActionMenu {...defaults} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(screen.getByText('Open bin')).toBeDefined();
    expect(screen.getByText('Checkout')).toBeDefined();
    expect(screen.getByText('Adjust quantity')).toBeDefined();
    expect(screen.getByText('Rename')).toBeDefined();
    expect(screen.getByText('Remove')).toBeDefined();
  });

  it('shows only Open bin when canWrite is false', () => {
    render(<ItemActionMenu {...defaults} canWrite={false} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(screen.getByText('Open bin')).toBeDefined();
    expect(screen.queryByText('Checkout')).toBeNull();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('shows only Restore & open when isTrashed', () => {
    render(<ItemActionMenu {...defaults} isTrashed onRestoreBin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(screen.getByText(/Restore/i)).toBeDefined();
    expect(screen.queryByText('Checkout')).toBeNull();
  });

  it('invokes onCheckout when the Checkout menu item is clicked', () => {
    const onCheckout = vi.fn();
    render(<ItemActionMenu {...defaults} onCheckout={onCheckout} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    fireEvent.click(screen.getByText('Checkout'));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('closes menu after action is chosen', () => {
    render(<ItemActionMenu {...defaults} />);
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    fireEvent.click(screen.getByText('Checkout'));
    expect(screen.queryByText('Open bin')).toBeNull();
  });
});
