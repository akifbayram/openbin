import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionCheckbox } from '../SelectionCheckbox';

describe('SelectionCheckbox', () => {
  it('renders an unchecked input', () => {
    render(<SelectionCheckbox checked={false} onToggle={vi.fn()} label="Select Tent" />);
    const cb = screen.getByRole('checkbox', { name: /select tent/i });
    expect((cb as HTMLInputElement).checked).toBe(false);
  });

  it('renders checked state', () => {
    render(<SelectionCheckbox checked={true} onToggle={vi.fn()} label="x" />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('invokes onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<SelectionCheckbox checked={false} onToggle={onToggle} label="x" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('invokes onToggle when clicked while already checked', () => {
    const onToggle = vi.fn();
    render(<SelectionCheckbox checked={true} onToggle={onToggle} label="x" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
