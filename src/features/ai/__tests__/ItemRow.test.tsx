import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemRow } from '../ItemRow';

describe('ItemRow (display)', () => {
  const baseItem = { id: 'i1', name: 'Tent', quantity: null };

  it('renders the item name', () => {
    render(<ItemRow item={baseItem} binId="b1" />);
    expect(screen.getByText('Tent')).toBeDefined();
  });

  it('renders the quantity badge when quantity is set', () => {
    render(<ItemRow item={{ ...baseItem, quantity: 4 }} binId="b1" />);
    expect(screen.getByText(/×\s*4/)).toBeDefined();
  });

  it('does not render a quantity badge when quantity is null', () => {
    const { container } = render(<ItemRow item={baseItem} binId="b1" />);
    expect(container.textContent).not.toMatch(/×/);
  });
});
