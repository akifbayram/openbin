import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { YearChipPager } from '../YearChipPager';

describe('YearChipPager', () => {
  it('shows only the currently selected year', () => {
    render(<YearChipPager years={[2024, 2025, 2026]} selected={2025} onSelect={() => {}} />);
    expect(screen.getByText('2025')).toBeDefined();
    expect(screen.queryByText('2024')).toBeNull();
    expect(screen.queryByText('2026')).toBeNull();
  });

  it('falls back to the newest year when none is selected', () => {
    render(<YearChipPager years={[2024, 2025, 2026]} selected={null} onSelect={() => {}} />);
    expect(screen.getByText('2026')).toBeDefined();
  });

  it('pager buttons move selection one year back/forward', () => {
    const onSelect = vi.fn();
    render(<YearChipPager years={[2024, 2025, 2026]} selected={2025} onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText('Previous year'));
    expect(onSelect).toHaveBeenCalledWith(2024);

    fireEvent.click(screen.getByLabelText('Next year'));
    expect(onSelect).toHaveBeenCalledWith(2026);
  });

  it('disables prev button on oldest year, next on newest', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<YearChipPager years={[2024, 2025, 2026]} selected={2024} onSelect={onSelect} />);
    expect(screen.getByLabelText('Previous year').getAttribute('disabled')).not.toBeNull();

    rerender(<YearChipPager years={[2024, 2025, 2026]} selected={2026} onSelect={onSelect} />);
    expect(screen.getByLabelText('Next year').getAttribute('disabled')).not.toBeNull();
  });

  it('renders nothing when years list is empty', () => {
    const { container } = render(<YearChipPager years={[]} selected={null} onSelect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
