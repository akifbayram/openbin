import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { PhotoGroupingGrid } from '../PhotoGroupingGrid';
import { type BulkAddState, createGroupFromPhoto, createPhoto, initialState, type Photo } from '../useBulkGroupAdd';

vi.mock('@/features/areas/AreaPicker', () => ({
  AreaPicker: () => <div data-testid="area-picker" />,
}));

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
    location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
    area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
  }),
}));

function makeFile(name = 'a.jpg'): File {
  return new File([''], name, { type: 'image/jpeg' });
}

function makeStateWithPhotos(count: number): BulkAddState {
  let state = initialState;
  for (let i = 0; i < count; i++) {
    const p = createPhoto(makeFile(`a${i}.jpg`));
    state = { ...state, groups: [...state.groups, createGroupFromPhoto(p, null)] };
  }
  return state;
}

function renderGrid(state: BulkAddState, props: Partial<React.ComponentProps<typeof PhotoGroupingGrid>> = {}) {
  return render(
    <ToastProvider>
      <PhotoGroupingGrid
        state={state}
        dispatch={vi.fn()}
        effectiveMax={20}
        locationId="loc-1"
        fileInputRef={{ current: null }}
        onAddMore={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
        {...props}
      />
    </ToastProvider>,
  );
}

describe('PhotoGroupingGrid skeleton', () => {
  it('renders one tile per photo across all groups', () => {
    const state = makeStateWithPhotos(3);
    renderGrid(state);
    const tiles = screen.getAllByRole('img', { name: /photo \d+/i });
    expect(tiles).toHaveLength(3);
  });

  it('renders an "Add more" tile when total photos < effectiveMax', () => {
    renderGrid(makeStateWithPhotos(2), { effectiveMax: 20 });
    expect(screen.getByLabelText(/add more photos/i)).toBeDefined();
  });

  it('hides the "Add more" tile when total photos === effectiveMax', () => {
    renderGrid(makeStateWithPhotos(3), { effectiveMax: 3 });
    expect(screen.queryByLabelText(/add more photos/i)).toBeNull();
  });

  it('renders Back and Continue buttons', () => {
    renderGrid(makeStateWithPhotos(1));
    expect(screen.getByRole('button', { name: /back/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDefined();
  });

  it('disables Continue when there are no groups', () => {
    renderGrid(initialState);
    const cont = screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
  });
});

describe('PhotoGroupingGrid counts header', () => {
  it('shows "1 photo · 1 bin" with singular for one photo and one group', () => {
    renderGrid(makeStateWithPhotos(1));
    expect(screen.getByText(/1 photo · 1 bin/)).toBeDefined();
  });

  it('shows "3 photos · 3 bins" with plural for three photos in three groups', () => {
    renderGrid(makeStateWithPhotos(3));
    expect(screen.getByText(/3 photos · 3 bins/)).toBeDefined();
  });

  it('shows "Tap a gap to join bins" subhead when N > 1', () => {
    renderGrid(makeStateWithPhotos(2));
    expect(screen.getByText(/Tap a gap to join bins/)).toBeDefined();
  });

  it('hides "Tap a gap to join bins" subhead when N === 1', () => {
    renderGrid(makeStateWithPhotos(1));
    expect(screen.queryByText(/Tap a gap to join bins/)).toBeNull();
  });

  it('hides the helper strip when N === 1', () => {
    renderGrid(makeStateWithPhotos(1));
    expect(screen.queryByText(/Default: each photo/)).toBeNull();
  });

  it('shows the helper strip when N > 1 and no toggles have happened', () => {
    renderGrid(makeStateWithPhotos(2));
    expect(screen.getByText(/Default: each photo/)).toBeDefined();
  });

  it('hides the helper strip when lastToggle is set', () => {
    const state: BulkAddState = { ...makeStateWithPhotos(2), lastToggle: { snapshot: [], verb: 'Joined' as const } };
    renderGrid(state);
    expect(screen.queryByText(/Default: each photo/)).toBeNull();
  });
});

describe('PhotoGroupingGrid gaps', () => {
  it('renders no gap buttons when there is only one photo', () => {
    renderGrid(makeStateWithPhotos(1));
    expect(screen.queryAllByRole('button', { name: /Join bin|Split bin/ })).toHaveLength(0);
  });

  it('renders a "Join bin N with bin N+1" split-gap between two singleton groups', () => {
    renderGrid(makeStateWithPhotos(2));
    expect(screen.getByRole('button', { name: 'Join bin 1 with bin 2' })).toBeDefined();
  });

  it('renders a "Split bin N" joined-gap inside a multi-photo group', () => {
    let state = makeStateWithPhotos(2);
    const [g1, g2] = state.groups;
    state = { ...state, groups: [{ ...g1, photos: [...g1.photos, ...g2.photos] }] };
    renderGrid(state);
    expect(screen.getByRole('button', { name: 'Split bin 1' })).toBeDefined();
  });
});

describe('PhotoGroupingGrid gap interactivity', () => {
  it('tapping a split gap dispatches JOIN_AT with the right boundaryIndex', () => {
    const dispatch = vi.fn();
    renderGrid(makeStateWithPhotos(3), { dispatch });
    fireEvent.click(screen.getByRole('button', { name: 'Join bin 2 with bin 3' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'JOIN_AT', boundaryIndex: 2 });
  });

  it('tapping a joined gap dispatches SPLIT_AT with the right boundaryIndex', () => {
    const dispatch = vi.fn();
    let state = makeStateWithPhotos(2);
    const [g1, g2] = state.groups;
    state = { ...state, groups: [{ ...g1, photos: [...g1.photos, ...g2.photos] }] };
    renderGrid(state, { dispatch });
    fireEvent.click(screen.getByRole('button', { name: 'Split bin 1' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SPLIT_AT', boundaryIndex: 1 });
  });

  it('shows an undo toast when lastToggle has been set', async () => {
    const state: BulkAddState = { ...makeStateWithPhotos(2), lastToggle: { snapshot: [], verb: 'Joined' as const } };
    renderGrid(state, { dispatch: vi.fn() });
    expect(await screen.findByText(/Joined/)).toBeDefined();
    expect(screen.getByRole('button', { name: /Undo/i })).toBeDefined();
  });

  it('clicking the undo button dispatches UNDO_LAST_TOGGLE', async () => {
    const dispatch = vi.fn();
    const state: BulkAddState = { ...makeStateWithPhotos(2), lastToggle: { snapshot: [], verb: 'Split' as const } };
    renderGrid(state, { dispatch });
    fireEvent.click(await screen.findByRole('button', { name: /Undo/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'UNDO_LAST_TOGGLE' });
  });
});

describe('PhotoGroupingGrid cap-disabled state', () => {
  function makeGroupedState(groupSizes: number[]): BulkAddState {
    let state = initialState;
    for (const size of groupSizes) {
      const photos: Photo[] = Array.from({ length: size }, (_, i) => createPhoto(makeFile(`p${i}.jpg`)));
      const grp = createGroupFromPhoto(photos[0], null);
      state = {
        ...state,
        groups: [...state.groups, { ...grp, photos }],
      };
    }
    return state;
  }

  it('aria-disabled is true on a split-gap when joining would exceed 5 photos', () => {
    renderGrid(makeGroupedState([3, 3]));
    const gap = screen.getByRole('button', { name: 'Join bin 1 with bin 2' });
    expect(gap.getAttribute('aria-disabled')).toBe('true');
  });

  it('aria-disabled is false on a split-gap when join would exactly equal 5 photos', () => {
    renderGrid(makeGroupedState([3, 2]));
    const gap = screen.getByRole('button', { name: 'Join bin 1 with bin 2' });
    expect(gap.getAttribute('aria-disabled')).toBe('false');
  });

  it('clicking a disabled gap does NOT dispatch JOIN_AT', () => {
    const dispatch = vi.fn();
    renderGrid(makeGroupedState([3, 3]), { dispatch });
    fireEvent.click(screen.getByRole('button', { name: 'Join bin 1 with bin 2' }));
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'JOIN_AT' }));
  });

  it('clicking a disabled gap shows the cap tooltip', async () => {
    renderGrid(makeGroupedState([3, 3]));
    fireEvent.click(screen.getByRole('button', { name: 'Join bin 1 with bin 2' }));
    expect(await screen.findByText(/Max 5 photos per bin/)).toBeDefined();
  });
});

describe('PhotoGroupingGrid photo management', () => {
  it('clicking the X on a photo dispatches REMOVE_PHOTO with that photoId', () => {
    const dispatch = vi.fn();
    let state = initialState;
    const p = createPhoto(makeFile('a.jpg'));
    state = { ...state, groups: [createGroupFromPhoto(p, null)] };
    renderGrid(state, { dispatch });
    fireEvent.click(screen.getByLabelText('Remove photo 1'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_PHOTO', photoId: p.id });
  });

  it('clicking add-more triggers fileInputRef.click()', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    renderGrid(makeStateWithPhotos(1));
    fireEvent.click(screen.getByLabelText('Add more photos'));
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
