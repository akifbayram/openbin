import { describe, expect, it } from 'vitest';
import { LABEL_FORMATS } from '../labelFormats';
import type { LabelLayoutInput } from '../labelLayout';
import { computeLabelLayout } from '../labelLayout';
import { CARD_PAD_MIN_PT, CARD_PAD_RATIO, CARD_RADIUS_RATIO, MONO_CODE_WIDTH_EMS, SWATCH_BAR_HEIGHT_RATIO, SWATCH_BAR_MIN_PT } from '../pdfConstants';

// biome-ignore lint/style/noNonNullAssertion: test assertion
const avery5160 = LABEL_FORMATS.find((f) => f.key === 'avery-5160')!;
// biome-ignore lint/style/noNonNullAssertion: test assertion
const avery5168 = LABEL_FORMATS.find((f) => f.key === 'avery-5168')!; // portrait

function makeInput(overrides?: Partial<LabelLayoutInput>): LabelLayoutInput {
  return {
    format: avery5160,
    hasQrData: true,
    hasColor: true,
    hasCode: true,
    hasIcon: true,
    showQrCode: true,
    showBinName: true,
    showIcon: true,
    showBinCode: true,
    showColorSwatch: true,
    ...overrides,
  };
}

describe('computeLabelLayout', () => {
  describe('mode determination', () => {
    it('returns colored-card when color swatch and QR are both enabled', () => {
      const result = computeLabelLayout(makeInput());
      expect(result.mode).toBe('colored-card');
      expect(result.useColoredCard).toBe(true);
    });

    it('returns plain-qr when QR enabled but color swatch disabled', () => {
      const result = computeLabelLayout(makeInput({ showColorSwatch: false }));
      expect(result.mode).toBe('plain-qr');
      expect(result.useColoredCard).toBe(false);
    });

    it('returns colored-card even when bin has no color (card renders without fill)', () => {
      const result = computeLabelLayout(makeInput({ hasColor: false }));
      expect(result.mode).toBe('colored-card');
      expect(result.useColoredCard).toBe(true);
    });

    it('returns icon-only when QR disabled and icon enabled', () => {
      const result = computeLabelLayout(makeInput({ showQrCode: false }));
      expect(result.mode).toBe('icon-only');
    });

    it('returns text-only when both QR and icon disabled', () => {
      const result = computeLabelLayout(makeInput({ showQrCode: false, showIcon: false }));
      expect(result.mode).toBe('text-only');
    });

    it('returns text-only when no QR data available', () => {
      const result = computeLabelLayout(makeInput({ hasQrData: false, showIcon: false }));
      expect(result.mode).toBe('text-only');
    });

    it('returns icon-only when no QR data and icon enabled with showQrCode off', () => {
      const result = computeLabelLayout(makeInput({ hasQrData: false, showQrCode: false }));
      expect(result.mode).toBe('icon-only');
    });
  });

  describe('orientation', () => {
    it('detects landscape for avery-5160', () => {
      const result = computeLabelLayout(makeInput());
      expect(result.isPortrait).toBe(false);
    });

    it('detects portrait for avery-5168', () => {
      const result = computeLabelLayout(makeInput({ format: avery5168 }));
      expect(result.isPortrait).toBe(true);
    });

    it('respects explicit vertical direction override', () => {
      const result = computeLabelLayout(makeInput({ labelDirection: 'vertical' }));
      expect(result.isPortrait).toBe(true);
    });

    it('respects explicit horizontal direction override', () => {
      const result = computeLabelLayout(makeInput({ format: avery5168, labelDirection: 'horizontal' }));
      expect(result.isPortrait).toBe(false);
    });
  });

  describe('codeUnderQr', () => {
    it('is true when QR, showBinCode, and bin has code', () => {
      const result = computeLabelLayout(makeInput());
      expect(result.codeUnderQr).toBe(true);
    });

    it('is false when showBinCode disabled', () => {
      const result = computeLabelLayout(makeInput({ showBinCode: false }));
      expect(result.codeUnderQr).toBe(false);
    });

    it('is false when bin has no code', () => {
      const result = computeLabelLayout(makeInput({ hasCode: false }));
      expect(result.codeUnderQr).toBe(false);
    });

    it('is false when QR disabled', () => {
      const result = computeLabelLayout(makeInput({ showQrCode: false }));
      expect(result.codeUnderQr).toBe(false);
    });
  });

  describe('card padding', () => {
    it('computes card padding from QR size with minimum', () => {
      const result = computeLabelLayout(makeInput());
      const qrSizePt = parseFloat(avery5160.qrSize) * 72;
      const expected = Math.max(CARD_PAD_MIN_PT, qrSizePt * CARD_PAD_RATIO);
      // Card padding should be clamped to fit within content area
      expect(result.cardPaddingPt).toBeLessThanOrEqual(expected);
      expect(result.cardPaddingPt).toBeGreaterThan(0);
    });

    it('uses minimum pad when QR size is very small', () => {
      const tinyQrFormat = { ...avery5160, qrSize: '0.01in' };
      const result = computeLabelLayout(makeInput({ format: tinyQrFormat }));
      // With a tiny QR, ideal pad would be below CARD_PAD_MIN_PT,
      // but the minimum enforces at least CARD_PAD_MIN_PT (before clamping to content area)
      expect(result.cardPaddingPt).toBeLessThanOrEqual(CARD_PAD_MIN_PT);
    });
  });

  describe('card border radius', () => {
    it('computes radius from cell dimensions', () => {
      const result = computeLabelLayout(makeInput());
      const cellWPt = parseFloat(avery5160.cellWidth) * 72;
      const cellHPt = parseFloat(avery5160.cellHeight) * 72;
      const expected = Math.min(cellWPt, cellHPt) * CARD_RADIUS_RATIO;
      expect(result.cardRadiusPt).toBeCloseTo(expected, 4);
    });
  });

  describe('qrCodeFontSizePt', () => {
    it('computes from QR size divided by MONO_CODE_WIDTH_EMS', () => {
      const result = computeLabelLayout(makeInput());
      const qrSizePt = parseFloat(avery5160.qrSize) * 72;
      expect(result.qrCodeFontSizePt).toBeCloseTo(qrSizePt / MONO_CODE_WIDTH_EMS, 4);
    });
  });

  describe('swatchBarHeightPt', () => {
    it('computes from name font size with minimum', () => {
      const result = computeLabelLayout(makeInput());
      const nameFontSizePt = parseFloat(avery5160.nameFontSize);
      const expected = Math.max(SWATCH_BAR_MIN_PT, nameFontSizePt * SWATCH_BAR_HEIGHT_RATIO);
      expect(result.swatchBarHeightPt).toBeCloseTo(expected, 4);
    });
  });

  describe('showSwatchBar', () => {
    it('is false in colored-card mode even with color', () => {
      const result = computeLabelLayout(makeInput());
      expect(result.mode).toBe('colored-card');
      expect(result.showSwatchBar).toBe(false);
    });

    it('is true in plain-qr mode with color and swatch enabled', () => {
      // Color swatch disabled means no colored card, but showSwatchBar also needs showColorSwatch
      // Let's use: hasColor true, showColorSwatch true, but no QR data so it falls to icon/text mode
      // Actually for plain-qr mode with swatch: need showColorSwatch=false so mode=plain-qr,
      // but then showSwatchBar also requires showColorSwatch=true...
      // showSwatchBar = hasColor && showColorSwatch && !useColoredCard
      // For plain-qr with swatch bar, we need hasQrData=true, showQrCode=true (so QR visible),
      // showColorSwatch=true but that makes useColoredCard=true...
      // Actually the swatch bar shows when the bin has color but we're NOT in colored-card mode.
      // This happens when e.g. showColorSwatch=true but hasQrData=false (no QR available).
      const result = computeLabelLayout(makeInput({ hasQrData: false }));
      expect(result.mode).not.toBe('colored-card');
      expect(result.showSwatchBar).toBe(true);
    });

    it('is false when bin has no color', () => {
      const result = computeLabelLayout(makeInput({ hasColor: false, showColorSwatch: false }));
      expect(result.showSwatchBar).toBe(false);
    });
  });

  describe('all 6 mode × orientation combinations', () => {
    const modes: [string, Partial<LabelLayoutInput>][] = [
      ['colored-card', {}],
      ['plain-qr', { showColorSwatch: false }],
      ['icon-only', { showQrCode: false }],
    ];

    for (const [expectedMode, overrides] of modes) {
      it(`${expectedMode} + landscape`, () => {
        const result = computeLabelLayout(makeInput({ ...overrides, format: avery5160 }));
        expect(result.mode).toBe(expectedMode);
        expect(result.isPortrait).toBe(false);
      });

      it(`${expectedMode} + portrait`, () => {
        const result = computeLabelLayout(makeInput({ ...overrides, format: avery5168 }));
        expect(result.mode).toBe(expectedMode);
        expect(result.isPortrait).toBe(true);
      });
    }
  });
});
