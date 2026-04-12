import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiTurnCommandPreview } from '../AiTurnCommandPreview';
import type { CommandAction } from '../useCommand';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
    area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
    location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
  }),
}));

describe('AiTurnCommandPreview', () => {
  const actions: CommandAction[] = [{ type: 'create_bin', name: 'X' } as CommandAction];

  it('renders Apply button when status is pending', () => {
    render(
      <AiTurnCommandPreview
        turnId="t1"
        actions={actions}
        interpretation="Create X"
        checkedActions={new Map([[0, true]])}
        status="pending"
        onToggleAction={vi.fn()}
        onExecute={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /apply/i })).toBeDefined();
  });

  it('hides Apply button when status is executed', () => {
    render(
      <AiTurnCommandPreview
        turnId="t1"
        actions={actions}
        interpretation=""
        checkedActions={new Map([[0, true]])}
        status="executed"
        onToggleAction={vi.fn()}
        onExecute={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
  });

  it('calls onExecute with turnId when Apply is clicked (non-destructive)', () => {
    const onExecute = vi.fn();
    render(
      <AiTurnCommandPreview
        turnId="t1"
        actions={actions}
        interpretation=""
        checkedActions={new Map([[0, true]])}
        status="pending"
        onToggleAction={vi.fn()}
        onExecute={onExecute}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onExecute).toHaveBeenCalledWith('t1');
  });

  it('requires two-click confirm for destructive actions', () => {
    const onExecute = vi.fn();
    const destructiveActions: CommandAction[] = [
      { type: 'delete_bin', bin_id: 'b1', bin_name: 'Old' } as CommandAction,
    ];
    render(
      <AiTurnCommandPreview
        turnId="t1"
        actions={destructiveActions}
        interpretation=""
        checkedActions={new Map([[0, true]])}
        status="pending"
        onToggleAction={vi.fn()}
        onExecute={onExecute}
      />,
    );
    // First click switches to "Confirm" state, does NOT execute
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onExecute).not.toHaveBeenCalled();
    // Second click on Confirm executes
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onExecute).toHaveBeenCalledWith('t1');
  });

  it('shows progress bar and disables button when status is executing', () => {
    render(
      <AiTurnCommandPreview
        turnId="t1"
        actions={actions}
        interpretation=""
        checkedActions={new Map([[0, true]])}
        status="executing"
        onToggleAction={vi.fn()}
        onExecute={vi.fn()}
        executingProgress={{ current: 0, total: 1 }}
      />,
    );
    expect(screen.getByRole('button', { name: /applying/i })).toBeDefined();
    expect((screen.getByRole('button', { name: /applying/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
