import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandActionList } from '../CommandActionList';
import type { CommandAction } from '../useCommand';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
    area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
    location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
  }),
}));

describe('CommandActionList', () => {
  const actions: CommandAction[] = [
    { type: 'create_bin', name: 'Tools' } as CommandAction,
    { type: 'delete_bin', bin_id: 'abc', bin_name: 'Old' } as CommandAction,
  ];

  it('renders interpretation and actions', () => {
    render(
      <CommandActionList
        actions={actions}
        interpretation="Create a bin and delete another"
        checkedActions={new Map()}
        toggleAction={vi.fn()}
        confirmDestructive={false}
        destructiveCount={1}
      />,
    );
    expect(screen.getByText(/Create a bin and delete another/)).toBeDefined();
  });

  it('renders destructive confirm banner when confirmDestructive is true', () => {
    render(
      <CommandActionList
        actions={actions}
        interpretation=""
        checkedActions={new Map()}
        toggleAction={vi.fn()}
        confirmDestructive={true}
        destructiveCount={1}
      />,
    );
    expect(screen.getByText(/destructive action/i)).toBeDefined();
  });

  it('does NOT render Apply or Back buttons', () => {
    render(
      <CommandActionList
        actions={actions}
        interpretation=""
        checkedActions={new Map()}
        toggleAction={vi.fn()}
        confirmDestructive={false}
        destructiveCount={0}
      />,
    );
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('calls toggleAction with the action index on click', () => {
    const toggle = vi.fn();
    render(
      <CommandActionList
        actions={actions}
        interpretation=""
        checkedActions={new Map()}
        toggleAction={toggle}
        confirmDestructive={false}
        destructiveCount={0}
      />,
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(toggle).toHaveBeenCalledWith(0);
  });
});
