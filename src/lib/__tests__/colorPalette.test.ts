import { describe, it, expect } from 'vitest';
import {
  resolveColor,
  parseColorKey,
  buildColorKey,
  hslToHex,
  hexToHsl,
  getHueRange,
  HUE_RANGES,
  SHADE_COUNT,
} from '@/lib/colorPalette';

describe('colorPalette', () => {
  describe('parseColorKey', () => {
    it('parses chromatic key', () => {
      expect(parseColorKey('210:2')).toEqual({ hue: 210, shade: 2 });
    });

    it('parses neutral key', () => {
      expect(parseColorKey('neutral:3')).toEqual({ hue: 'neutral', shade: 3 });
    });

    it('returns null for empty string', () => {
      expect(parseColorKey('')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(parseColorKey('blue')).toBeNull();
      expect(parseColorKey('abc:xyz')).toBeNull();
    });

    it('returns null for out-of-range shade', () => {
      expect(parseColorKey('210:5')).toBeNull();
      expect(parseColorKey('210:-1')).toBeNull();
    });
  });

  describe('buildColorKey', () => {
    it('builds chromatic key', () => {
      expect(buildColorKey(210, 2)).toBe('210:2');
    });

    it('builds neutral key', () => {
      expect(buildColorKey('neutral', 0)).toBe('neutral:0');
    });
  });

  describe('hslToHex', () => {
    it('converts pure red', () => {
      expect(hslToHex(0, 100, 50)).toBe('#FF0000');
    });

    it('converts pure green', () => {
      expect(hslToHex(120, 100, 50)).toBe('#00FF00');
    });

    it('converts pure blue', () => {
      expect(hslToHex(240, 100, 50)).toBe('#0000FF');
    });

    it('converts black', () => {
      expect(hslToHex(0, 0, 0)).toBe('#000000');
    });

    it('converts white', () => {
      expect(hslToHex(0, 0, 100)).toBe('#FFFFFF');
    });
  });

  describe('hexToHsl', () => {
    it('converts pure red', () => {
      const { h, s, l } = hexToHsl('#FF0000');
      expect(h).toBe(0);
      expect(s).toBe(100);
      expect(l).toBe(50);
    });

    it('round-trips through hslToHex', () => {
      const hex = hslToHex(210, 70, 52);
      const { h, s, l } = hexToHsl(hex);
      expect(h).toBeCloseTo(210, -1);
      expect(s).toBeCloseTo(70, -1);
      expect(l).toBeCloseTo(52, -1);
    });
  });

  describe('resolveColor', () => {
    it('resolves a new-format key', () => {
      const preset = resolveColor('210:2');
      expect(preset).toBeDefined();
      expect(preset!.key).toBe('210:2');
      expect(preset!.label).toBe('Blue');
      expect(preset!.dot).toMatch(/^#[0-9A-F]{6}$/);
      expect(preset!.bg).toMatch(/^#[0-9A-F]{6}$/);
      expect(preset!.bgDark).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('resolves neutral key', () => {
      const preset = resolveColor('neutral:2');
      expect(preset).toBeDefined();
      expect(preset!.label).toBe('Gray');
    });

    it('resolves legacy key "blue"', () => {
      const preset = resolveColor('blue');
      expect(preset).toBeDefined();
      expect(preset!.key).toBe('blue');
    });

    it('resolves legacy key "red-light"', () => {
      const preset = resolveColor('red-light');
      expect(preset).toBeDefined();
      expect(preset!.key).toBe('red-light');
    });

    it('returns undefined for empty string', () => {
      expect(resolveColor('')).toBeUndefined();
    });

    it('returns undefined for nonexistent key', () => {
      expect(resolveColor('nonexistent')).toBeUndefined();
    });

    it('produces all 5 shades for a hue', () => {
      for (let s = 0; s < SHADE_COUNT; s++) {
        const preset = resolveColor(`180:${s}`);
        expect(preset).toBeDefined();
      }
    });
  });

  describe('getHueRange', () => {
    it('maps blue hue to blue range', () => {
      expect(getHueRange('220:2')).toBe('blue');
    });

    it('maps neutral to neutral', () => {
      expect(getHueRange('neutral:1')).toBe('neutral');
    });

    it('maps legacy key to range', () => {
      expect(getHueRange('blue')).toBe('blue');
      expect(getHueRange('gray')).toBe('neutral');
    });

    it('returns null for empty string', () => {
      expect(getHueRange('')).toBeNull();
    });

    it('returns null for invalid key', () => {
      expect(getHueRange('nonexistent')).toBeNull();
    });

    it('handles red wrap-around', () => {
      expect(getHueRange('350:2')).toBe('red');
      expect(getHueRange('5:2')).toBe('red');
    });
  });

  describe('HUE_RANGES', () => {
    it('has 14 entries (13 chromatic + neutral)', () => {
      expect(HUE_RANGES).toHaveLength(14);
    });

    it('each range has required fields', () => {
      for (const range of HUE_RANGES) {
        expect(range.name).toBeTruthy();
        expect(range.label).toBeTruthy();
        expect(range.dot).toMatch(/^#[0-9A-F]{6}$/);
      }
    });
  });
});
