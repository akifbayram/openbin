import { describe, it, expect } from 'vitest';
import {
  resolveColor,
  parseColorKey,
  buildColorKey,
  hslToHex,
  hexToHsl,
  srgbMix,
  getHueRange,
  relativeLuminance,
  needsLightText,
  getApproxBgHex,
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

  describe('srgbMix', () => {
    it('returns base at 0%', () => {
      expect(srgbMix('#FF0000', '#FFFFFF', 0)).toBe('#FFFFFF');
    });

    it('returns ref at 100%', () => {
      expect(srgbMix('#FF0000', '#FFFFFF', 100)).toBe('#FF0000');
    });

    it('returns midpoint at 50%', () => {
      const result = srgbMix('#FF0000', '#000000', 50);
      // Should be approximately #800000
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
      const r = parseInt(result.substring(1, 3), 16);
      expect(r).toBeCloseTo(128, -1);
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
      expect(preset!.ref).toMatch(/^#[0-9A-F]{6}$/);
      expect(preset!.bgCss).toMatch(/^color-mix\(in oklch,/);
    });

    it('resolves neutral key', () => {
      const preset = resolveColor('neutral:2');
      expect(preset).toBeDefined();
      expect(preset!.label).toBe('Gray');
      expect(preset!.bgCss).toContain('color-mix(in oklch,');
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

    it('resolves "black" to fixed preset', () => {
      const preset = resolveColor('black');
      expect(preset).toBeDefined();
      expect(preset!.key).toBe('black');
      expect(preset!.label).toBe('Black');
      expect(preset!.ref).toBe('#1C1C1E');
      expect(preset!.dot).toBe('#1C1C1E');
      expect(preset!.bg).toBe('#1C1C1E');
      expect(preset!.bgCss).toBe('#1C1C1E');
    });

    it('resolves "white" to fixed preset', () => {
      const preset = resolveColor('white');
      expect(preset).toBeDefined();
      expect(preset!.key).toBe('white');
      expect(preset!.label).toBe('White');
      expect(preset!.ref).toBe('#F2F2F7');
      expect(preset!.dot).toBe('#F2F2F7');
      expect(preset!.bg).toBe('#F2F2F7');
      expect(preset!.bgCss).toBe('#F2F2F7');
    });

    it('produces all 5 shades for a hue', () => {
      for (let s = 0; s < SHADE_COUNT; s++) {
        const preset = resolveColor(`180:${s}`);
        expect(preset).toBeDefined();
        expect(preset!.bgCss).toContain('var(--bg-base)');
      }
    });

    it('bg is a valid hex for print fallback', () => {
      const preset = resolveColor('220:2');
      expect(preset!.bg).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('ref is consistent for same hue across shades', () => {
      const ref0 = resolveColor('220:0')!.ref;
      const ref4 = resolveColor('220:4')!.ref;
      expect(ref0).toBe(ref4);
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

    it('maps "black" to neutral', () => {
      expect(getHueRange('black')).toBe('neutral');
    });

    it('maps "white" to neutral', () => {
      expect(getHueRange('white')).toBe('neutral');
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

  describe('relativeLuminance', () => {
    it('returns ~0 for black', () => {
      expect(relativeLuminance('#000000')).toBeCloseTo(0, 2);
    });

    it('returns ~1 for white', () => {
      expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 2);
    });

    it('returns < 0.05 for near-black (#1C1C1E)', () => {
      expect(relativeLuminance('#1C1C1E')).toBeLessThan(0.05);
    });

    it('returns > 0.85 for near-white (#F2F2F7)', () => {
      expect(relativeLuminance('#F2F2F7')).toBeGreaterThan(0.85);
    });
  });

  describe('needsLightText', () => {
    it('returns true for black (#1C1C1E)', () => {
      expect(needsLightText('#1C1C1E')).toBe(true);
    });

    it('returns false for white (#F2F2F7)', () => {
      expect(needsLightText('#F2F2F7')).toBe(false);
    });

    it('returns true for pure black', () => {
      expect(needsLightText('#000000')).toBe(true);
    });

    it('returns false for pure white', () => {
      expect(needsLightText('#FFFFFF')).toBe(false);
    });
  });

  describe('getApproxBgHex', () => {
    it('returns bg for light theme', () => {
      const preset = resolveColor('220:2')!;
      expect(getApproxBgHex(preset, 'light')).toBe(preset.bg);
    });

    it('returns bgDark for dark theme', () => {
      const preset = resolveColor('220:2')!;
      expect(getApproxBgHex(preset, 'dark')).toBe(preset.bgDark);
    });

    it('returns same value for fixed black preset in both themes', () => {
      const preset = resolveColor('black')!;
      expect(getApproxBgHex(preset, 'light')).toBe('#1C1C1E');
      expect(getApproxBgHex(preset, 'dark')).toBe('#1C1C1E');
    });
  });

  describe('preset bgDark field', () => {
    it('computed presets have bgDark as a valid hex', () => {
      const preset = resolveColor('220:2');
      expect(preset!.bgDark).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('bgDark is darker than bg for same preset', () => {
      const preset = resolveColor('220:2')!;
      expect(relativeLuminance(preset.bgDark)).toBeLessThan(relativeLuminance(preset.bg));
    });

    it('fixed presets have bgDark', () => {
      expect(resolveColor('black')!.bgDark).toBe('#1C1C1E');
      expect(resolveColor('white')!.bgDark).toBe('#F2F2F7');
    });
  });
});
