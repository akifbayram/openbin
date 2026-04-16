import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemListOptionsCard } from '../ItemListOptionsCard';
import { DEFAULT_ITEM_LIST_OPTIONS } from '../usePrintSettings';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({ Bin: 'Bin', bin: 'bin' }),
}));

const defaultProps = {
  options: DEFAULT_ITEM_LIST_OPTIONS,
  onUpdate: vi.fn(),
  expanded: true,
  onExpandedChange: vi.fn(),
};

describe('ItemListOptionsCard', () => {
  it('renders three subsection headers when expanded', () => {
    render(<ItemListOptionsCard {...defaultProps} />);
    expect(screen.getByText('Header')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText('Layout')).toBeTruthy();
  });

  it('renders every header toggle', () => {
    render(<ItemListOptionsCard {...defaultProps} />);
    expect(screen.getByRole('checkbox', { name: 'QR code' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Icon & color' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Area path' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Bin code' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Item count' })).toBeTruthy();
  });

  it('renders every content toggle', () => {
    render(<ItemListOptionsCard {...defaultProps} />);
    expect(screen.getByRole('checkbox', { name: 'Checkboxes' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Quantity' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Write-in notes column' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Bin notes' })).toBeTruthy();
  });

  it('renders layout toggle and blank-rows stepper', () => {
    render(<ItemListOptionsCard {...defaultProps} />);
    expect(screen.getByRole('checkbox', { name: 'Alternating row shading' })).toBeTruthy();
    expect(screen.getByText('Blank rows at end')).toBeTruthy();
    // Stepper shows the current value
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('calls onUpdate with the right key when a header toggle is clicked', () => {
    const onUpdate = vi.fn();
    render(<ItemListOptionsCard {...defaultProps} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'QR code' }));
    expect(onUpdate).toHaveBeenCalledWith('showQrCode', false);
  });

  it('calls onUpdate with showNotesColumn when the write-in toggle is clicked', () => {
    const onUpdate = vi.fn();
    render(<ItemListOptionsCard {...defaultProps} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Write-in notes column' }));
    expect(onUpdate).toHaveBeenCalledWith('showNotesColumn', false);
  });

  it('increments blankRowCount through the stepper', () => {
    const onUpdate = vi.fn();
    render(<ItemListOptionsCard {...defaultProps} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /increase blank rows at end/i }));
    expect(onUpdate).toHaveBeenCalledWith('blankRowCount', 6);
  });

  it('disables the decrement button when blankRowCount is 0', () => {
    const onUpdate = vi.fn();
    render(
      <ItemListOptionsCard
        {...defaultProps}
        options={{ ...DEFAULT_ITEM_LIST_OPTIONS, blankRowCount: 0 }}
        onUpdate={onUpdate}
      />,
    );
    const dec = screen.getByRole('button', { name: /decrease blank rows at end/i }) as HTMLButtonElement;
    expect(dec.disabled).toBe(true);
  });

  it('collapses when expanded=false', () => {
    render(<ItemListOptionsCard {...defaultProps} expanded={false} />);
    expect(screen.queryByText('Header')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'QR code' })).toBeNull();
  });
});
