import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { PhotoGroupingGrid } from '../PhotoGroupingGrid';
import {
  type BulkAddState,
  createGroupFromPhoto,
  createPhoto,
  initialState,
  type Photo,
} from '../useBulkGroupAdd';

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

function makeGroupedState(groupSizes: number[]): BulkAddState {
  let state = initialState;
  for (const size of groupSizes) {
    const photos: Photo[] = Array.from({ length: size }, (_, i) =>
      createPhoto(makeFile(`p${i}.jpg`)),
    );
    const grp = createGroupFromPhoto(photos[0], null);
    state = { ...state, groups: [...state.groups, { ...grp, photos }] };
  }
  return state;
}

function renderGrid(
  state: BulkAddState,
  props: Partial<React.ComponentProps<typeof PhotoGroupingGrid>> = {},
) {
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
    renderGrid(makeStateWithPhotos(3));
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

  it('does not render the old JOIN/SPLIT gap buttons anywhere', () => {
    renderGrid(makeGroupedState([2, 2]));
    expect(screen.queryAllByRole('button', { name: /Join bin|Split bin/ })).toHaveLength(0);
  });
});

describe('PhotoGroupingGrid header', () => {
  it('shows the "One bin per stack" title with one photo', () => {
    renderGrid(makeStateWithPhotos(1));
    expect(screen.getByRole('heading', { name: /one bin per stack/i })).toBeDefined();
  });

  it('shows the "One bin per stack" title with multiple photos', () => {
    renderGrid(makeStateWithPhotos(3));
    expect(screen.getByRole('heading', { name: /one bin per stack/i })).toBeDefined();
  });

  it('shows the drag-to-stack subhead when N > 1', () => {
    renderGrid(makeStateWithPhotos(2));
    expect(
      screen.getByText(/Drag photos onto each other to put them in the same bin/i),
    ).toBeDefined();
  });

  it('shows the add-more-photos subhead when N === 1', () => {
    renderGrid(makeStateWithPhotos(1));
    expect(
      screen.getByText(/Add more photos to create several bins at once/i),
    ).toBeDefined();
  });
});

describe('PhotoGroupingGrid accessibility', () => {
  it('gives each bin an aria-label with count (singular)', () => {
    renderGrid(makeStateWithPhotos(3));
    expect(screen.getByRole('group', { name: 'Bin 1, 1 photo' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Bin 2, 1 photo' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Bin 3, 1 photo' })).toBeDefined();
  });

  it('multi-photo bin aria-label uses plural form with count', () => {
    renderGrid(makeGroupedState([3]));
    expect(screen.getByRole('group', { name: 'Bin 1, 3 photos' })).toBeDefined();
  });

  it('each top photo tile has role=button with a descriptive aria-label', () => {
    renderGrid(makeStateWithPhotos(2));
    expect(
      screen.getByRole('button', { name: /Photo 1 — drag to group with another photo/i }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: /Photo 2 — drag to group with another photo/i }),
    ).toBeDefined();
  });

  it('only the top photo of a stacked bin is keyboard-focusable', () => {
    renderGrid(makeGroupedState([3]));
    const tiles = screen.getAllByRole('button', { name: /Photo \d+ — drag to group/i });
    const focusable = tiles.filter((el) => (el as HTMLElement).tabIndex === 0);
    expect(focusable).toHaveLength(1);
  });
});

describe('PhotoGroupingGrid undo toast', () => {
  it('shows an undo toast when lastToggle has been set', async () => {
    const state: BulkAddState = {
      ...makeStateWithPhotos(2),
      lastToggle: { snapshot: [], verb: 'Joined' as const },
    };
    renderGrid(state, { dispatch: vi.fn() });
    expect(await screen.findByText(/Joined/)).toBeDefined();
    expect(screen.getByRole('button', { name: /Undo/i })).toBeDefined();
  });

  it('clicking the undo button dispatches UNDO_LAST_TOGGLE', async () => {
    const dispatch = vi.fn();
    const state: BulkAddState = {
      ...makeStateWithPhotos(2),
      lastToggle: { snapshot: [], verb: 'Split' as const },
    };
    renderGrid(state, { dispatch });
    fireEvent.click(await screen.findByRole('button', { name: /Undo/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'UNDO_LAST_TOGGLE' });
  });
});

describe('PhotoGroupingGrid photo management', () => {
  it('clicking the X on a photo dispatches REMOVE_PHOTO with that photoId', () => {
    const dispatch = vi.fn();
    const p = createPhoto(makeFile('a.jpg'));
    const state: BulkAddState = {
      ...initialState,
      groups: [createGroupFromPhoto(p, null)],
    };
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

describe('PhotoGroupingGrid keyboard move mode', () => {
  it('pressing Enter on a photo surfaces an in-progress move announcement', () => {
    renderGrid(makeStateWithPhotos(2));
    const photo1 = screen.getByRole('button', { name: /Photo 1 — drag to group/i });
    fireEvent.keyDown(photo1, { key: 'Enter' });
    const mentions = screen.getAllByText(/Moving photo 1/i);
    // One visible header hint + one aria-live region announcement
    expect(mentions.length).toBeGreaterThanOrEqual(2);
  });

  it('pressing Enter on a photo in another bin dispatches MOVE_PHOTO_TO_GROUP', () => {
    const dispatch = vi.fn();
    const state = makeStateWithPhotos(2);
    const sourcePhotoId = state.groups[0].photos[0].id;
    const targetGroupId = state.groups[1].id;
    renderGrid(state, { dispatch });
    const photo1 = screen.getByRole('button', { name: /Photo 1 — drag to group/i });
    const photo2 = screen.getByRole('button', { name: /Photo 2 — drag to group/i });
    fireEvent.keyDown(photo1, { key: 'Enter' });
    fireEvent.keyDown(photo2, { key: 'Enter' });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: sourcePhotoId,
      targetGroupId,
    });
  });

  it('pressing Escape exits move mode', () => {
    renderGrid(makeStateWithPhotos(2));
    const photo1 = screen.getByRole('button', { name: /Photo 1 — drag to group/i });
    fireEvent.keyDown(photo1, { key: 'Enter' });
    expect(screen.getAllByText(/Moving photo 1/i).length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryAllByText(/Moving photo 1/i)).toHaveLength(0);
  });

  it('does not show the "new bin" split button when source is a single-photo bin', () => {
    renderGrid(makeStateWithPhotos(2));
    const photo1 = screen.getByRole('button', { name: /Photo 1 — drag to group/i });
    fireEvent.keyDown(photo1, { key: 'Enter' });
    expect(screen.queryByRole('button', { name: /Move photo 1 to a new bin/i })).toBeNull();
  });

  it('shows the "new bin" split button when source is a multi-photo bin', () => {
    renderGrid(makeGroupedState([2]));
    const stackedTop = screen.getByRole('button', { name: /Photo 2 — drag to group/i });
    fireEvent.keyDown(stackedTop, { key: 'Enter' });
    expect(
      screen.getByRole('button', { name: /Move photo 2 to a new bin/i }),
    ).toBeDefined();
  });
});
