import { fireEvent, render, screen } from '@testing-library/react';
import { Trash2, X } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { type BulkAction, BulkActionBar } from './BulkActionBar';

function setup(props: Partial<React.ComponentProps<typeof BulkActionBar>> = {}) {
  const onClear = vi.fn();
  const onDelete = vi.fn();
  const actions: BulkAction[] = [
    { id: 'delete', icon: Trash2, label: 'Delete', onClick: onDelete, group: 'primary', danger: true },
    { id: 'extra', icon: X, label: 'Extra', onClick: vi.fn(), group: 'more' },
  ];
  render(<BulkActionBar selectedCount={3} actions={actions} onClear={onClear} {...props} />);
  return { onClear, onDelete };
}

describe('BulkActionBar', () => {
  it('renders the selection count', () => {
    setup();
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('renders primary actions inline', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('renders more actions in the overflow menu after click', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
  });

  it('calls onClick when a primary action is clicked', () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('clear button calls onClear', () => {
    const { onClear } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('isBusy disables actions', () => {
    setup({ isBusy: true });
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('hides actions where show is false', () => {
    const onClear = vi.fn();
    const actions: BulkAction[] = [
      { id: 'visible', icon: Trash2, label: 'Visible', onClick: vi.fn(), group: 'primary' },
      { id: 'hidden', icon: Trash2, label: 'Hidden', onClick: vi.fn(), group: 'primary', show: false },
    ];
    render(<BulkActionBar selectedCount={1} actions={actions} onClear={onClear} />);
    expect(screen.queryByRole('button', { name: 'Hidden' })).not.toBeInTheDocument();
  });

  it('uses selectionLabel override when provided', () => {
    const onClear = vi.fn();
    render(
      <BulkActionBar selectedCount={2} actions={[]} onClear={onClear} selectionLabel="2 tags chosen" />,
    );
    expect(screen.getByText('2 tags chosen')).toBeInTheDocument();
  });

  it('does not render the More button when no more actions exist', () => {
    const onClear = vi.fn();
    const actions: BulkAction[] = [
      { id: 'delete', icon: Trash2, label: 'Delete', onClick: vi.fn(), group: 'primary' },
    ];
    render(<BulkActionBar selectedCount={1} actions={actions} onClear={onClear} />);
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('closes the more popover after a more-action is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Extra' }));
    expect(screen.queryByRole('button', { name: 'Extra' })).not.toBeInTheDocument();
  });

  it('closes the more popover when clicking outside it', () => {
    const onClear = vi.fn();
    const actions: BulkAction[] = [
      { id: 'extra', icon: X, label: 'Extra', onClick: vi.fn(), group: 'more' },
    ];
    render(
      <div>
        <button type="button" data-testid="outside">outside</button>
        <BulkActionBar selectedCount={1} actions={actions} onClear={onClear} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('button', { name: 'Extra' })).not.toBeInTheDocument();
  });

  it('renders a divider above more-actions with dividerBefore: true', () => {
    const onClear = vi.fn();
    const actions: BulkAction[] = [
      { id: 'first', icon: Trash2, label: 'First', onClick: vi.fn(), group: 'more' },
      { id: 'sep', icon: Trash2, label: 'After Divider', onClick: vi.fn(), group: 'more', dividerBefore: true },
    ];
    const { container } = render(<BulkActionBar selectedCount={1} actions={actions} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    // The divider is a div with `border-t` styling.
    const dividers = container.querySelectorAll('.border-t');
    expect(dividers.length).toBeGreaterThanOrEqual(1);
  });
});
