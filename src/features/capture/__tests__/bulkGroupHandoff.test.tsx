import { describe, expect, it } from 'vitest';
import { initBulkAddStateFromFiles } from '@/features/bins/PhotoBulkAdd';
import {
  getCapturedReturnTarget,
  setCapturedPhotos,
  setCapturedReturnTarget,
  takeCapturedPhotos,
} from '../capturedPhotos';

describe('bulk-group camera → PhotoBulkAdd handoff', () => {
  it('round-trips grouped photos from capture to PhotoBulkAdd state', () => {
    const files = [
      new File(['a'], 'bin1-photo1.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'bin1-photo2.jpg', { type: 'image/jpeg' }),
      new File(['c'], 'bin2-photo1.jpg', { type: 'image/jpeg' }),
    ];
    const groupIds = [0, 0, 1];

    setCapturedPhotos(files, groupIds);
    setCapturedReturnTarget('bin-create');

    expect(getCapturedReturnTarget()).toBe('bin-create');
    const taken = takeCapturedPhotos();
    expect(taken.files).toEqual(files);
    expect(taken.groups).toEqual(groupIds);

    const state = initBulkAddStateFromFiles(taken.files, taken.groups);
    expect(state.groups).toHaveLength(2);
    expect(state.groups[0].photos).toHaveLength(2);
    expect(state.groups[0].photos[0].file.name).toBe('bin1-photo1.jpg');
    expect(state.groups[0].photos[1].file.name).toBe('bin1-photo2.jpg');
    expect(state.groups[1].photos).toHaveLength(1);
    expect(state.groups[1].photos[0].file.name).toBe('bin2-photo1.jpg');
  });

  it('handles flat handoff (no grouping) for gallery-upload compatibility', () => {
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ];
    setCapturedPhotos(files);
    const taken = takeCapturedPhotos();
    expect(taken.groups).toBeNull();

    const state = initBulkAddStateFromFiles(taken.files, taken.groups);
    expect(state.groups).toHaveLength(2); // one group per photo (legacy behavior)
  });
});
