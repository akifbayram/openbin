import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BinGroupHeader } from '../BinGroupHeader';

describe('BinGroupHeader', () => {
  it('renders bin name and area', () => {
    render(
      <BinGroupHeader
        name="Camping Gear"
        areaName="Garage"
        icon=""
        color="#22c55e"
        isTrashed={false}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('Camping Gear')).toBeDefined();
    expect(screen.getByText('Garage')).toBeDefined();
  });

  it('invokes onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(
      <BinGroupHeader name="X" areaName="" icon="" color="#000" isTrashed={false} onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('applies trashed styling when isTrashed', () => {
    const { container } = render(
      <BinGroupHeader name="X" areaName="" icon="" color="#000" isTrashed onOpen={vi.fn()} />,
    );
    expect(container.querySelector('[data-trashed="true"]')).toBeTruthy();
  });
});
