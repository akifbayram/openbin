export interface ColorPreset {
  key: string;
  label: string;
  ref: string;
  dot: string;
  bg: string;
  bgDark: string;
  bgCss: string;
}

export const SHADE_COUNT = 5;

// Shade parameters: [dotS, dotL, mixPercent]
// mixPercent controls how much of the reference color mixes into --bg-base
const SHADE_PARAMS: [number, number, number][] = [
  [80, 72, 25], // 0 lightest
  [75, 62, 40], // 1 light
  [70, 52, 55], // 2 medium
  [65, 42, 70], // 3 dark
  [60, 32, 90], // 4 darkest
];

// Fixed reference color saturation/lightness for the vivid per-hue color
const REF_S = 80;
const REF_L = 65;

// Light-mode base for print/PDF hex fallback
const LIGHT_BASE = '#f2f2f7';

// Dark-mode base for approximate dark bg hex
const DARK_BASE = '#000000';

/** Linear sRGB interpolation between two hex colors. Returns uppercase hex. */
export function srgbMix(refHex: string, baseHex: string, percent: number): string {
  const parse = (hex: string) => {
    const raw = hex.replace('#', '');
    return [
      parseInt(raw.substring(0, 2), 16) / 255,
      parseInt(raw.substring(2, 4), 16) / 255,
      parseInt(raw.substring(4, 6), 16) / 255,
    ];
  };
  const [r1, g1, b1] = parse(refHex);
  const [r2, g2, b2] = parse(baseHex);
  const t = percent / 100;
  const mix = (a: number, b: number) => Math.round((a * t + b * (1 - t)) * 255);
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`.toUpperCase();
}

// Hue name boundaries: [minHue, maxHue, name]
const HUE_NAMES: [number, number, string][] = [
  [0, 14, 'Red'],
  [14, 40, 'Orange'],
  [40, 55, 'Yellow'],
  [55, 80, 'Lime'],
  [80, 150, 'Green'],
  [150, 170, 'Teal'],
  [170, 190, 'Cyan'],
  [190, 210, 'Sky'],
  [210, 240, 'Blue'],
  [240, 270, 'Indigo'],
  [270, 300, 'Purple'],
  [300, 330, 'Pink'],
  [330, 346, 'Rose'],
  [346, 361, 'Red'],
];

function getHueName(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  for (const [min, max, name] of HUE_NAMES) {
    if (h >= min && h < max) return name;
  }
  return 'Red';
}

export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = ((h % 360) + 360) % 360;
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0, g = 0, b = 0;
  if (hNorm < 60) { r = c; g = x; }
  else if (hNorm < 120) { r = x; g = c; }
  else if (hNorm < 180) { g = c; b = x; }
  else if (hNorm < 240) { g = x; b = c; }
  else if (hNorm < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const raw = hex.replace('#', '');
  const r = parseInt(raw.substring(0, 2), 16) / 255;
  const g = parseInt(raw.substring(2, 4), 16) / 255;
  const b = parseInt(raw.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function parseColorKey(key: string): { hue: number | 'neutral'; shade: number } | null {
  if (!key) return null;
  const parts = key.split(':');
  if (parts.length !== 2) return null;
  const shade = parseInt(parts[1], 10);
  if (isNaN(shade) || shade < 0 || shade >= SHADE_COUNT) return null;
  if (parts[0] === 'neutral') return { hue: 'neutral', shade };
  const hue = parseInt(parts[0], 10);
  if (isNaN(hue)) return null;
  return { hue, shade };
}

export function buildColorKey(hue: number | 'neutral', shade: number): string {
  return `${hue}:${shade}`;
}

function computePreset(hue: number | 'neutral', shade: number): ColorPreset {
  const [dotS, dotL, mixPct] = SHADE_PARAMS[shade];
  const h = hue === 'neutral' ? 0 : hue;
  const s = hue === 'neutral' ? 0 : 1;
  const key = buildColorKey(hue, shade);
  const label = hue === 'neutral' ? 'Gray' : getHueName(h);
  const ref = hslToHex(h, REF_S * s, REF_L);
  const dot = hslToHex(h, dotS * s, dotL);
  const bg = srgbMix(ref, LIGHT_BASE, mixPct);
  const bgDark = srgbMix(ref, DARK_BASE, mixPct);
  const bgCss = `color-mix(in oklch, ${ref} ${mixPct}%, var(--bg-base))`;
  return { key, label, ref, dot, bg, bgDark, bgCss };
}

// Fixed presets for black/white (no color-mix, consistent across themes)
export const BLACK_PRESET: ColorPreset = {
  key: 'black',
  label: 'Black',
  ref: '#1C1C1E',
  dot: '#1C1C1E',
  bg: '#1C1C1E',
  bgDark: '#1C1C1E',
  bgCss: '#1C1C1E',
};

export const WHITE_PRESET: ColorPreset = {
  key: 'white',
  label: 'White',
  ref: '#F2F2F7',
  dot: '#F2F2F7',
  bg: '#F2F2F7',
  bgDark: '#F2F2F7',
  bgCss: '#F2F2F7',
};

const FIXED_KEY_MAP: Record<string, ColorPreset> = {
  black: BLACK_PRESET,
  white: WHITE_PRESET,
};

// Legacy key → new key map for backward compatibility
const LEGACY_KEY_MAP: Record<string, string> = {
  'red-light': '0:0', 'red': '0:2', 'red-dark': '0:4',
  'orange-light': '25:0', 'orange': '25:2', 'orange-dark': '25:4',
  'amber-light': '45:0', 'amber': '45:2', 'amber-dark': '45:4',
  'lime-light': '80:0', 'lime': '80:2', 'lime-dark': '80:4',
  'green-light': '140:0', 'green': '140:2', 'green-dark': '140:4',
  'teal-light': '170:0', 'teal': '170:2', 'teal-dark': '170:4',
  'cyan-light': '185:0', 'cyan': '185:2', 'cyan-dark': '185:4',
  'sky-light': '200:0', 'sky': '200:2', 'sky-dark': '200:4',
  'blue-light': '220:0', 'blue': '220:2', 'blue-dark': '220:4',
  'indigo-light': '245:0', 'indigo': '245:2', 'indigo-dark': '245:4',
  'purple-light': '280:0', 'purple': '280:2', 'purple-dark': '280:4',
  'rose-light': '340:0', 'rose': '340:2', 'rose-dark': '340:4',
  'pink-light': '320:0', 'pink': '320:2', 'pink-dark': '320:4',
  'gray-light': 'neutral:0', 'gray': 'neutral:2', 'gray-dark': 'neutral:4',
};

const resolveCache = new Map<string, ColorPreset | undefined>();

export function resolveColor(key: string): ColorPreset | undefined {
  if (!key) return undefined;
  const cached = resolveCache.get(key);
  if (cached !== undefined) return cached;

  // Check fixed presets (black/white)
  const fixed = FIXED_KEY_MAP[key];
  if (fixed) {
    resolveCache.set(key, fixed);
    return fixed;
  }

  // Try parsing as new hue:shade format
  const parsed = parseColorKey(key);
  if (parsed) {
    const preset = computePreset(parsed.hue, parsed.shade);
    resolveCache.set(key, preset);
    return preset;
  }

  // Try legacy key
  const mapped = LEGACY_KEY_MAP[key];
  if (mapped) {
    const legacyParsed = parseColorKey(mapped);
    if (legacyParsed) {
      const preset = computePreset(legacyParsed.hue, legacyParsed.shade);
      // Store with original key so label says old name but colors are new
      const result = { ...preset, key };
      resolveCache.set(key, result);
      return result;
    }
  }

  resolveCache.set(key, undefined);
  return undefined;
}

/** @deprecated Use resolveColor instead */
export const getColorPreset = resolveColor;

// Hue ranges for the filter UI
export interface HueRange {
  name: string;
  label: string;
  dot: string;
  minHue: number;
  maxHue: number;
}

export const HUE_RANGES: HueRange[] = [
  { name: 'red',    label: 'Red',    dot: hslToHex(0, 70, 52),   minHue: 346, maxHue: 14 },
  { name: 'orange', label: 'Orange', dot: hslToHex(25, 70, 52),  minHue: 14,  maxHue: 40 },
  { name: 'yellow', label: 'Yellow', dot: hslToHex(48, 70, 52),  minHue: 40,  maxHue: 55 },
  { name: 'lime',   label: 'Lime',   dot: hslToHex(80, 70, 52),  minHue: 55,  maxHue: 80 },
  { name: 'green',  label: 'Green',  dot: hslToHex(140, 70, 52), minHue: 80,  maxHue: 150 },
  { name: 'teal',   label: 'Teal',   dot: hslToHex(170, 70, 52), minHue: 150, maxHue: 170 },
  { name: 'cyan',   label: 'Cyan',   dot: hslToHex(185, 70, 52), minHue: 170, maxHue: 190 },
  { name: 'sky',    label: 'Sky',    dot: hslToHex(200, 70, 52), minHue: 190, maxHue: 210 },
  { name: 'blue',   label: 'Blue',   dot: hslToHex(220, 70, 52), minHue: 210, maxHue: 240 },
  { name: 'indigo', label: 'Indigo', dot: hslToHex(245, 70, 52), minHue: 240, maxHue: 270 },
  { name: 'purple', label: 'Purple', dot: hslToHex(280, 70, 52), minHue: 270, maxHue: 300 },
  { name: 'pink',   label: 'Pink',   dot: hslToHex(320, 70, 52), minHue: 300, maxHue: 330 },
  { name: 'rose',   label: 'Rose',   dot: hslToHex(340, 70, 52), minHue: 330, maxHue: 346 },
  { name: 'neutral', label: 'Gray',  dot: hslToHex(0, 0, 52),   minHue: -1,  maxHue: -1 },
];

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(parseInt(raw.substring(0, 2), 16));
  const g = toLinear(parseInt(raw.substring(2, 4), 16));
  const b = toLinear(parseInt(raw.substring(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when the background is dark enough to need light (white) text. */
export function needsLightText(bgHex: string): boolean {
  return relativeLuminance(bgHex) < 0.4;
}

/** Return the approximate background hex for a preset, given the active theme. */
export function getApproxBgHex(preset: ColorPreset, theme: 'light' | 'dark'): string {
  return theme === 'dark' ? preset.bgDark : preset.bg;
}

export function getHueRange(colorKey: string): string | null {
  if (!colorKey) return null;

  // Fixed keys map to neutral (gray filter)
  if (colorKey in FIXED_KEY_MAP) return 'neutral';

  // Resolve legacy keys first
  const effectiveKey = LEGACY_KEY_MAP[colorKey] ?? colorKey;
  const parsed = parseColorKey(effectiveKey);
  if (!parsed) return null;

  if (parsed.hue === 'neutral') return 'neutral';

  const h = ((parsed.hue % 360) + 360) % 360;
  for (const range of HUE_RANGES) {
    if (range.name === 'neutral') continue;
    // Handle the red wrap-around case
    if (range.minHue > range.maxHue) {
      if (h >= range.minHue || h < range.maxHue) return range.name;
    } else {
      if (h >= range.minHue && h < range.maxHue) return range.name;
    }
  }
  return null;
}
