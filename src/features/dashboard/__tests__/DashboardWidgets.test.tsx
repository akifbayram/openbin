import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from '../DashboardWidgets';

describe('StatCard', () => {
  it('renders with default variant (no warning styles)', () => {
    const { container } = render(<StatCard label="Total Bins" value={5} />);
    const wrapper = container.querySelector('[class*="bg-"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('bg-[var(--bg-input)]');
    expect(wrapper?.className).not.toContain('color-warning');
  });

  it('renders with warning variant styling', () => {
    const { container } = render(<StatCard label="Checked Out" value={3} variant="warning" />);
    const wrapper = container.querySelector('[class*="bg-"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('bg-[var(--color-warning-soft)]');
  });

  it('applies warning color to the value text', () => {
    render(<StatCard label="Checked Out" value={3} variant="warning" />);
    const value = screen.getByText('3');
    expect(value.className).toContain('text-[var(--color-warning)]');
  });

  it('is clickable when onClick is provided', () => {
    const { container } = render(<StatCard label="Test" value={1} onClick={() => {}} />);
    expect(container.querySelector('button')).not.toBeNull();
  });
});
