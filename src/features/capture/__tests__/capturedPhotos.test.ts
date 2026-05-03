import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCapturedReturnTarget,
  hasCapturedPhotos,
  setCapturedPhotos,
  setCapturedReturnTarget,
  takeCapturedPhotos,
} from '../capturedPhotos';

beforeEach(() => {
  takeCapturedPhotos();
});

describe('capturedPhotos store', () => {
  it('starts with no captured photos', () => {
    expect(hasCapturedPhotos()).toBe(false);
  });

  it('reports photos after setCapturedPhotos', () => {
    const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
    setCapturedPhotos(files);

    expect(hasCapturedPhotos()).toBe(true);
  });

  it('takeCapturedPhotos returns files and null groups when no grouping provided', () => {
    const files = [new File(['x'], 'x.jpg')];
    setCapturedPhotos(files);

    const taken = takeCapturedPhotos();
    expect(taken.files).toHaveLength(1);
    expect(taken.files[0].name).toBe('x.jpg');
    expect(taken.groups).toBeNull();
  });

  it('takeCapturedPhotos clears pending on subsequent calls', () => {
    setCapturedPhotos([new File(['y'], 'y.jpg')]);

    takeCapturedPhotos();

    expect(hasCapturedPhotos()).toBe(false);
    const empty = takeCapturedPhotos();
    expect(empty.files).toHaveLength(0);
    expect(empty.groups).toBeNull();
  });

  it('round-trips a parallel groups array', () => {
    const files = [
      new File(['a'], 'a.jpg'),
      new File(['b'], 'b.jpg'),
      new File(['c'], 'c.jpg'),
    ];
    setCapturedPhotos(files, [0, 0, 1]);

    const taken = takeCapturedPhotos();
    expect(taken.files).toHaveLength(3);
    expect(taken.groups).toEqual([0, 0, 1]);
  });

  it('clears groups on take', () => {
    setCapturedPhotos([new File([''], 'f.jpg')], [5]);
    takeCapturedPhotos();

    const empty = takeCapturedPhotos();
    expect(empty.files).toHaveLength(0);
    expect(empty.groups).toBeNull();
  });

  it('manages bin-create return target', () => {
    expect(getCapturedReturnTarget()).toBeNull();

    setCapturedReturnTarget('bin-create');
    expect(getCapturedReturnTarget()).toBe('bin-create');

    setCapturedReturnTarget(null);
    expect(getCapturedReturnTarget()).toBeNull();
  });

  it('takeCapturedPhotos resets return target', () => {
    setCapturedReturnTarget('bin-create');
    setCapturedPhotos([new File([''], 'f.jpg')], [0]);

    takeCapturedPhotos();

    expect(getCapturedReturnTarget()).toBeNull();
  });
});
