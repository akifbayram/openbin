import { describe, expect, it } from 'vitest';
import { getPremadeUrl, isPremadeAsset, PREMADE_BACKGROUNDS } from '../premadeBackgrounds';

describe('premadeBackgrounds', () => {
  it('registry has 4 entries', () => {
    expect(PREMADE_BACKGROUNDS).toHaveLength(4);
  });

  it('each entry has id, label, and src', () => {
    for (const bg of PREMADE_BACKGROUNDS) {
      expect(bg.id).toBeTruthy();
      expect(bg.label).toBeTruthy();
      expect(typeof bg.src).toBe('string');
    }
  });

  it('ids are unique', () => {
    const ids = PREMADE_BACKGROUNDS.map((bg) => bg.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('isPremadeAsset returns true for known IDs', () => {
    expect(isPremadeAsset('bin-blue')).toBe(true);
    expect(isPremadeAsset('bin-gray')).toBe(true);
  });

  it('isPremadeAsset returns false for unknown IDs', () => {
    expect(isPremadeAsset('unknown')).toBe(false);
    expect(isPremadeAsset('')).toBe(false);
  });

  it('getPremadeUrl returns undefined for unknown IDs', () => {
    expect(getPremadeUrl('unknown')).toBeUndefined();
  });
});
