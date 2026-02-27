import { describe, it, expect } from 'vitest';
import {
  applyOrientation,
  computeRowsPerPage,
  computeLabelsPerPage,
  computePageSize,
  computeCodeFontSize,
  buildColorMap,
  getLabelFormat,
  getOrientation,
  isVerticalLayout,
  filterLabelFormats,
  LABEL_FORMATS,
} from '../labelFormats';
import type { LabelFormat } from '../labelFormats';
import type { Bin } from '@/types';

/** Minimal label format for testing. */
function makeFormat(overrides: Partial<LabelFormat> = {}): LabelFormat {
  return {
    key: 'test',
    name: 'Test Format',
    columns: 3,
    cellWidth: '2.633in',
    cellHeight: '1in',
    qrSize: '0.75in',
    padding: '2pt 4pt',
    nameFontSize: '8pt',
    contentFontSize: '6.5pt',
    codeFontSize: '14pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.3in',
    pageMarginRight: '0.3in',
    pageWidth: 8.5,
    pageHeight: 11,
    ...overrides,
  };
}

describe('getOrientation', () => {
  it('defaults to landscape when not specified', () => {
    expect(getOrientation(makeFormat())).toBe('landscape');
  });

  it('returns explicit orientation', () => {
    expect(getOrientation(makeFormat({ orientation: 'portrait' }))).toBe('portrait');
  });
});

describe('applyOrientation', () => {
  it('returns the same format when target matches current orientation', () => {
    const fmt = makeFormat();
    expect(applyOrientation(fmt, 'landscape')).toBe(fmt);
  });

  it('returns the same format when target is undefined', () => {
    const fmt = makeFormat();
    expect(applyOrientation(fmt, undefined)).toBe(fmt);
  });

  it('swaps cell dimensions when toggling orientation', () => {
    const fmt = makeFormat({ cellWidth: '4in', cellHeight: '2in' });
    const flipped = applyOrientation(fmt, 'portrait');
    expect(flipped.cellWidth).toBe('2in');
    expect(flipped.cellHeight).toBe('4in');
    expect(flipped.orientation).toBe('portrait');
  });

  it('swaps page dimensions', () => {
    const fmt = makeFormat({ pageWidth: 8.5, pageHeight: 11 });
    const flipped = applyOrientation(fmt, 'portrait');
    expect(flipped.pageWidth).toBe(11);
    expect(flipped.pageHeight).toBe(8.5);
  });

  it('swaps margins (top/bottom <-> left/right)', () => {
    const fmt = makeFormat({
      pageMarginTop: '0.5in',
      pageMarginBottom: '0.4in',
      pageMarginLeft: '0.3in',
      pageMarginRight: '0.2in',
    });
    const flipped = applyOrientation(fmt, 'portrait');
    expect(flipped.pageMarginTop).toBe('0.3in');
    expect(flipped.pageMarginBottom).toBe('0.2in');
    expect(flipped.pageMarginLeft).toBe('0.5in');
    expect(flipped.pageMarginRight).toBe('0.4in');
  });

  it('recomputes columns after dimension swap', () => {
    const fmt = makeFormat({
      cellWidth: '2.633in',
      cellHeight: '1in',
      columns: 3,
      pageWidth: 8.5,
      pageHeight: 11,
      pageMarginLeft: '0.3in',
      pageMarginRight: '0.3in',
    });
    const flipped = applyOrientation(fmt, 'portrait');
    // After swap: cellWidth = '1in', pageWidth = 11, margins swapped
    expect(parseFloat(flipped.cellWidth)).toBe(1);
    expect(flipped.columns).toBeGreaterThanOrEqual(1);
  });

  it('roundtrip returns to original dimensions', () => {
    const fmt = makeFormat({ cellWidth: '4in', cellHeight: '2in', pageWidth: 8.5, pageHeight: 11 });
    const flipped = applyOrientation(fmt, 'portrait');
    const restored = applyOrientation(flipped, 'landscape');
    expect(restored.cellWidth).toBe(fmt.cellWidth);
    expect(restored.cellHeight).toBe(fmt.cellHeight);
    expect(restored.pageWidth).toBe(fmt.pageWidth);
    expect(restored.pageHeight).toBe(fmt.pageHeight);
  });
});

describe('computeRowsPerPage', () => {
  it('computes rows for standard format', () => {
    const fmt = makeFormat({
      cellHeight: '1in',
      pageHeight: 11,
      pageMarginTop: '0.5in',
      pageMarginBottom: '0.5in',
    });
    // Available = 11 - 0.5 - 0.5 = 10, rows = floor(10/1) = 10
    expect(computeRowsPerPage(fmt)).toBe(10);
  });

  it('returns at least 1 row', () => {
    const fmt = makeFormat({ cellHeight: '20in', pageHeight: 11 });
    expect(computeRowsPerPage(fmt)).toBe(1);
  });

  it('handles fractional rows correctly', () => {
    const fmt = makeFormat({
      cellHeight: '3.3333in',
      pageHeight: 11,
      pageMarginTop: '0.5in',
      pageMarginBottom: '0.5in',
    });
    // Available = 10, rows = floor(10/3.3333) = 3
    expect(computeRowsPerPage(fmt)).toBe(3);
  });
});

describe('computeLabelsPerPage', () => {
  it('multiplies rows by columns', () => {
    const fmt = makeFormat({
      columns: 3,
      cellHeight: '1in',
      pageHeight: 11,
      pageMarginTop: '0.5in',
      pageMarginBottom: '0.5in',
    });
    expect(computeLabelsPerPage(fmt)).toBe(30);
  });

  it('returns 1 for single-label formats', () => {
    const fmt = makeFormat({
      columns: 1,
      cellHeight: '4in',
      pageHeight: 6,
      pageMarginTop: '0.625in',
      pageMarginBottom: '0.625in',
    });
    expect(computeLabelsPerPage(fmt)).toBe(1);
  });
});

describe('computePageSize', () => {
  it('uses explicit pageWidth/pageHeight when provided', () => {
    const fmt = makeFormat({ pageWidth: 8.5, pageHeight: 11 });
    const { width, height } = computePageSize(fmt);
    expect(width).toBe(8.5);
    expect(height).toBe(11);
  });

  it('computes tight-fit dimensions when pageWidth/pageHeight not provided', () => {
    const fmt = makeFormat({
      columns: 2,
      cellWidth: '4in',
      cellHeight: '3in',
      pageMarginLeft: '0.25in',
      pageMarginRight: '0.25in',
      pageMarginTop: '0.5in',
      pageMarginBottom: '0.5in',
      pageWidth: undefined,
      pageHeight: undefined,
    });
    const { width, height } = computePageSize(fmt);
    // width = 0.25 + 2*4 + 0.25 = 8.5
    expect(width).toBeCloseTo(8.5, 2);
    // rows depend on default page height (11) - margins = 10, floor(10/3) = 3
    // height = 0.5 + 3*3 + 0.5 = 10
    expect(height).toBeCloseTo(10, 2);
  });
});

describe('isVerticalLayout', () => {
  it('returns false for landscape format with auto direction', () => {
    const fmt = makeFormat(); // default landscape
    expect(isVerticalLayout(fmt, 'auto')).toBe(false);
  });

  it('returns true for portrait format with auto direction', () => {
    const fmt = makeFormat({ orientation: 'portrait' });
    expect(isVerticalLayout(fmt, 'auto')).toBe(true);
  });

  it('defaults to auto when labelDirection is undefined', () => {
    expect(isVerticalLayout(makeFormat())).toBe(false);
    expect(isVerticalLayout(makeFormat({ orientation: 'portrait' }))).toBe(true);
  });

  it('overrides landscape format to vertical', () => {
    const fmt = makeFormat(); // landscape
    expect(isVerticalLayout(fmt, 'vertical')).toBe(true);
  });

  it('overrides portrait format to horizontal', () => {
    const fmt = makeFormat({ orientation: 'portrait' });
    expect(isVerticalLayout(fmt, 'horizontal')).toBe(false);
  });

  it('horizontal on landscape is still horizontal', () => {
    const fmt = makeFormat();
    expect(isVerticalLayout(fmt, 'horizontal')).toBe(false);
  });

  it('vertical on portrait is still vertical', () => {
    const fmt = makeFormat({ orientation: 'portrait' });
    expect(isVerticalLayout(fmt, 'vertical')).toBe(true);
  });
});

describe('computeCodeFontSize', () => {
  it('returns at least the format codeFontSize', () => {
    const fmt = makeFormat({ codeFontSize: '14pt' });
    expect(computeCodeFontSize(fmt)).toBeGreaterThanOrEqual(14);
  });

  it('returns larger size for wider cells', () => {
    const narrow = makeFormat({ cellWidth: '2in', codeFontSize: '10pt' });
    const wide = makeFormat({ cellWidth: '4in', codeFontSize: '10pt' });
    expect(computeCodeFontSize(wide)).toBeGreaterThanOrEqual(computeCodeFontSize(narrow));
  });

  it('caps at 25% of cell height', () => {
    const fmt = makeFormat({ cellHeight: '1in', cellWidth: '10in', codeFontSize: '8pt' });
    const cap = 0.25 * parseFloat(fmt.cellHeight) * 72;
    expect(computeCodeFontSize(fmt)).toBeLessThanOrEqual(cap + 0.01);
  });

  it('uses full cell width when labelDirection is vertical', () => {
    // Use tall cell (4in → cap = 72pt) so the cap does not mask the difference
    const fmt = makeFormat({ cellWidth: '2in', cellHeight: '4in', qrSize: '0.75in', codeFontSize: '8pt' });
    const autoSize = computeCodeFontSize(fmt); // landscape auto — subtracts QR width
    const verticalSize = computeCodeFontSize(fmt, 'vertical'); // full width available
    expect(verticalSize).toBeGreaterThan(autoSize);
  });

  it('subtracts QR width when labelDirection is horizontal on portrait format', () => {
    const fmt = makeFormat({ orientation: 'portrait', cellWidth: '2in', cellHeight: '4in', qrSize: '0.75in', codeFontSize: '8pt' });
    const autoSize = computeCodeFontSize(fmt); // portrait auto — full width
    const horizontalSize = computeCodeFontSize(fmt, 'horizontal'); // subtracts QR
    expect(horizontalSize).toBeLessThan(autoSize);
  });
});

describe('buildColorMap', () => {
  const makeBin = (id: string, color: string): Bin => ({
    id,
    location_id: 'loc1',
    name: `Bin ${id}`,
    area_id: null,
    area_name: '',
    items: [],
    notes: '',
    tags: [],
    icon: 'box',
    color,
    card_style: '',
    created_by: 'user1',
    created_by_name: 'User',
    visibility: 'location',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });

  it('returns undefined when showColorSwatch is false', () => {
    expect(buildColorMap([makeBin('abc123', 'red')], false)).toBeUndefined();
  });

  it('returns undefined when no bins have colors', () => {
    expect(buildColorMap([makeBin('abc123', '')], true)).toBeUndefined();
  });

  it('builds color map for bins with valid colors', () => {
    const bins = [makeBin('abc123', 'blue-3')];
    const map = buildColorMap(bins, true);
    if (map) {
      expect(map.has('abc123')).toBe(true);
      const entry = map.get('abc123')!;
      expect(entry.dark).toBe('#000000');
      expect(entry.light).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('getLabelFormat', () => {
  it('returns format by key', () => {
    const fmt = getLabelFormat('avery-5160');
    expect(fmt.key).toBe('avery-5160');
  });

  it('falls back to first format for unknown key', () => {
    const fmt = getLabelFormat('nonexistent');
    expect(fmt.key).toBe(LABEL_FORMATS[0].key);
  });

  it('finds custom presets', () => {
    const custom: LabelFormat = makeFormat({ key: 'custom-1', name: 'My Custom' });
    const fmt = getLabelFormat('custom-1', [custom]);
    expect(fmt.name).toBe('My Custom');
  });
});

describe('filterLabelFormats', () => {
  it('returns all formats for empty query', () => {
    expect(filterLabelFormats('')).toEqual(LABEL_FORMATS);
  });

  it('filters by name', () => {
    const results = filterLabelFormats('5160');
    expect(results.some((f) => f.key === 'avery-5160')).toBe(true);
  });

  it('filters by cross-reference number', () => {
    // 5260 is a cross-reference for avery-5160
    const results = filterLabelFormats('5260');
    expect(results.some((f) => f.key === 'avery-5160')).toBe(true);
  });

  it('returns empty array for no matches', () => {
    expect(filterLabelFormats('zzz-nonexistent')).toEqual([]);
  });
});
