import { describe, expect, it } from 'vitest';
import { initBulkAddStateFromFiles } from '@/features/bins/PhotoBulkAdd';

function f(name: string): File {
  return new File([''], name, { type: 'image/jpeg' });
}

describe('initBulkAddStateFromFiles', () => {
  it('creates one group per photo when no groupIds provided', () => {
    const state = initBulkAddStateFromFiles([f('a.jpg'), f('b.jpg')], null);
    expect(state.groups).toHaveLength(2);
    expect(state.groups[0].photos).toHaveLength(1);
    expect(state.groups[1].photos).toHaveLength(1);
  });

  it('buckets by groupIds parallel array', () => {
    const state = initBulkAddStateFromFiles(
      [f('a.jpg'), f('b.jpg'), f('c.jpg'), f('d.jpg')],
      [0, 0, 1, 1],
    );
    expect(state.groups).toHaveLength(2);
    expect(state.groups[0].photos).toHaveLength(2);
    expect(state.groups[1].photos).toHaveLength(2);
  });

  it('preserves insertion order of group IDs', () => {
    const state = initBulkAddStateFromFiles(
      [f('a.jpg'), f('b.jpg')],
      [7, 3],
    );
    expect(state.groups[0].photos[0].file.name).toBe('a.jpg');
    expect(state.groups[1].photos[0].file.name).toBe('b.jpg');
  });

  it('falls back to per-photo when arrays mismatch', () => {
    const state = initBulkAddStateFromFiles(
      [f('a.jpg'), f('b.jpg')],
      [0],
    );
    expect(state.groups).toHaveLength(2);
  });

  it('returns empty when no files', () => {
    const state = initBulkAddStateFromFiles([], null);
    expect(state.groups).toHaveLength(0);
  });
});
