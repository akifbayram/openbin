import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GroupSummaryStep } from '../GroupSummaryStep';
import { type BulkAddState, createGroupFromPhoto, createPhoto, initialState } from '../useBulkGroupAdd';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
  }),
}));

vi.mock('@/lib/iconMap', () => ({
  resolveIcon: () => ({ Plus: () => null }),
}));

vi.mock('@/lib/colorPalette', () => ({
  resolveColor: () => undefined,
}));

function makeState(): BulkAddState {
  const p1 = createPhoto(new File([''], 'a.jpg', { type: 'image/jpeg' }));
  const p2 = createPhoto(new File([''], 'b.jpg', { type: 'image/jpeg' }));
  const g1 = { ...createGroupFromPhoto(p1, null), name: 'Bin one', items: [{ id: 'i1', name: 'thing', quantity: null }], status: 'reviewed' as const };
  const g2 = { ...createGroupFromPhoto(p2, null), name: 'Bin two', status: 'reviewed' as const };
  return { ...initialState, step: 'summary', groups: [g1, g2] };
}

function renderStep(state: BulkAddState, props: Partial<React.ComponentProps<typeof GroupSummaryStep>> = {}) {
  return render(
    <GroupSummaryStep
      groups={state.groups}
      isCreating={state.isCreating}
      createdCount={state.createdCount}
      dispatch={vi.fn()}
      onCreateAll={vi.fn()}
      onRetryFailed={vi.fn()}
      {...props}
    />
  );
}

describe('GroupSummaryStep', () => {
  it('shows "Create N bins" header with the confirmed count', () => {
    renderStep(makeState());
    expect(screen.getByText(/Create 2 Bins/)).toBeDefined();
  });

  it('renders each confirmed group with name', () => {
    renderStep(makeState());
    expect(screen.getByText('Bin one')).toBeDefined();
    expect(screen.getByText('Bin two')).toBeDefined();
  });

  it('Create button calls onCreateAll', () => {
    const onCreateAll = vi.fn();
    renderStep(makeState(), { onCreateAll });
    fireEvent.click(screen.getByRole('button', { name: /create 2 bins/i }));
    expect(onCreateAll).toHaveBeenCalled();
  });

  it('clicking edit on a row dispatches SET_EDITING_FROM_SUMMARY + SET_CURRENT_INDEX + GO_TO_REVIEW', () => {
    const dispatch = vi.fn();
    renderStep(makeState(), { dispatch });
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[1]);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_EDITING_FROM_SUMMARY', value: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CURRENT_INDEX', index: 1 });
    expect(dispatch).toHaveBeenCalledWith({ type: 'GO_TO_REVIEW' });
  });

  it('shows "N photos" badge on multi-photo groups', () => {
    let state = makeState();
    const p3 = createPhoto(new File([''], 'c.jpg', { type: 'image/jpeg' }));
    const p4 = createPhoto(new File([''], 'd.jpg', { type: 'image/jpeg' }));
    state = {
      ...state,
      groups: [
        { ...state.groups[0], photos: [...state.groups[0].photos, p3, p4] },
        state.groups[1],
      ],
    };
    renderStep(state);
    expect(screen.getByText(/3 photos/)).toBeDefined();
  });

  it('Edit dispatches SET_CURRENT_INDEX with the global groups index, not the confirmedWithName index', () => {
    const dispatch = vi.fn();
    // 3 groups: middle one has no name (filtered out of confirmedWithName)
    const p1 = createPhoto(new File([''], 'a.jpg', { type: 'image/jpeg' }));
    const p2 = createPhoto(new File([''], 'b.jpg', { type: 'image/jpeg' }));
    const p3 = createPhoto(new File([''], 'c.jpg', { type: 'image/jpeg' }));
    const g1 = { ...createGroupFromPhoto(p1, null), name: 'First', status: 'reviewed' as const };
    const g2 = { ...createGroupFromPhoto(p2, null), name: '', status: 'pending' as const }; // filtered out
    const g3 = { ...createGroupFromPhoto(p3, null), name: 'Third', status: 'reviewed' as const };
    const state: BulkAddState = { ...initialState, step: 'summary', groups: [g1, g2, g3] };
    renderStep(state, { dispatch });
    // Only First and Third are in confirmedWithName; click edit on Third (the second visible row)
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[1]);
    // Must dispatch index 2 (G3's position in state.groups), NOT index 1 (its position in confirmedWithName)
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CURRENT_INDEX', index: 2 });
  });
});
