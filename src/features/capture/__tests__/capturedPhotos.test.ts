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

  it('takeCapturedPhotos returns and clears photos', () => {
    const files = [new File(['x'], 'x.jpg')];
    setCapturedPhotos(files);

    const taken = takeCapturedPhotos();
    expect(taken).toHaveLength(1);
    expect(taken[0].name).toBe('x.jpg');

    expect(hasCapturedPhotos()).toBe(false);
    expect(takeCapturedPhotos()).toHaveLength(0);
  });

  it('manages return target', () => {
    expect(getCapturedReturnTarget()).toBeNull();

    setCapturedReturnTarget('bin-create');
    expect(getCapturedReturnTarget()).toBe('bin-create');

    setCapturedReturnTarget(null);
    expect(getCapturedReturnTarget()).toBeNull();
  });

  it('takeCapturedPhotos resets return target', () => {
    setCapturedReturnTarget('bin-create');
    setCapturedPhotos([new File([''], 'f.jpg')]);

    takeCapturedPhotos();

    expect(getCapturedReturnTarget()).toBeNull();
  });
});
