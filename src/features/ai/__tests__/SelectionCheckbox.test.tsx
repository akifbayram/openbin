import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionCheckbox } from '../SelectionCheckbox';

describe('SelectionCheckbox', () => {
  it('renders an unchecked input', () => {
    render(<SelectionCheckbox checked={false} onChange={vi.fn()} label="Select Tent" />);
    const cb = screen.getByRole('checkbox', { name: /select tent/i });
    expect((cb as HTMLInputElement).checked).toBe(false);
  });

  it('renders checked state', () => {
    render(<SelectionCheckbox checked={true} onChange={vi.fn()} label="x" />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('calls onChange with true when toggled on', () => {
    const onChange = vi.fn();
    render(<SelectionCheckbox checked={false} onChange={onChange} label="x" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when toggled off', () => {
    const onChange = vi.fn();
    render(<SelectionCheckbox checked={true} onChange={onChange} label="x" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
