import { describe, expect, it } from 'vitest';
import { LABEL_FORMATS } from '../labelFormats';
import type { LabelLayoutInput } from '../labelLayout';
import { computeLabelLayout } from '../labelLayout';
import { MONO_CODE_WIDTH_EMS } from '../pdfConstants';

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
    it('returns plain-qr when QR is available', () => {
      const result = computeLabelLayout(makeInput());
      expect(result.mode).toBe('plain-qr');
    });

    it('returns plain-qr when color swatch is disabled but QR is on', () => {
      const result = computeLabelLayout(makeInput({ showColorSwatch: false }));
      expect(result.mode).toBe('plain-qr');
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

  describe('useColoredCell', () => {
    it('is true when showColorSwatch and hasColor are both true', () => {
      const result = computeLabelLayout(makeInput());
      expect(result.useColoredCell).toBe(true);
    });

    it('is true even in icon-only mode when showColorSwatch and hasColor are true', () => {
      const result = computeLabelLayout(makeInput({ showQrCode: false }));
      expect(result.mode).toBe('icon-only');
      expect(result.useColoredCell).toBe(true);
    });

    it('is true even in text-only mode when showColorSwatch and hasColor are true', () => {
      const result = computeLabelLayout(makeInput({ showQrCode: false, showIcon: false }));
      expect(result.mode).toBe('text-only');
      expect(result.useColoredCell).toBe(true);
    });

    it('is false when bin has no color', () => {
      const result = computeLabelLayout(makeInput({ hasColor: false }));
      expect(result.useColoredCell).toBe(false);
    });

    it('is false when showColorSwatch is disabled', () => {
      const result = computeLabelLayout(makeInput({ showColorSwatch: false }));
      expect(result.useColoredCell).toBe(false);
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

  describe('qrCodeFontSizePt', () => {
    it('computes from QR size divided by MONO_CODE_WIDTH_EMS', () => {
      const result = computeLabelLayout(makeInput());
      expect(result.qrCodeFontSizePt).toBeCloseTo(result.qrSizePt / MONO_CODE_WIDTH_EMS, 4);
    });
  });

  describe('dynamic QR sizing', () => {
    it('grows QR beyond static size for large portrait cells', () => {
      const result = computeLabelLayout(makeInput({ format: avery5168 }));
      const staticQr = parseFloat(avery5168.qrSize) * 72;
      expect(result.qrSizePt).toBeGreaterThan(staticQr);
    });

    it('QR stays close to static size for tightly-fit formats', () => {
      // biome-ignore lint/style/noNonNullAssertion: test assertion
      const avery5163 = LABEL_FORMATS.find((f) => f.key === 'avery-5163')!;
      const result = computeLabelLayout(makeInput({ format: avery5163 }));
      const staticQr = parseFloat(avery5163.qrSize) * 72;
      expect(result.qrSizePt).toBeGreaterThanOrEqual(staticQr);
      expect(result.qrSizePt).toBeLessThan(staticQr * 1.1);
    });

    it('uses at least the static qrSize as minimum', () => {
      for (const fmt of LABEL_FORMATS) {
        const result = computeLabelLayout(makeInput({ format: fmt }));
        const staticQr = parseFloat(fmt.qrSize) * 72;
        expect(result.qrSizePt).toBeGreaterThanOrEqual(staticQr);
      }
    });

    it('QR does not exceed content width in portrait', () => {
      const result = computeLabelLayout(makeInput({ format: avery5168 }));
      const pad = { left: 10, right: 10 }; // avery5168 padding: 8pt 10pt
      const contentW = parseFloat(avery5168.cellWidth) * 72 - pad.left - pad.right;
      expect(result.qrSizePt).toBeLessThanOrEqual(contentW);
    });

    it('QR uses a substantial portion of portrait cell height', () => {
      const result = computeLabelLayout(makeInput({ format: avery5168 }));
      const cellH = parseFloat(avery5168.cellHeight) * 72;
      expect(result.qrSizePt).toBeGreaterThan(cellH * 0.5);
    });
  });

  describe('mode × orientation combinations', () => {
    const modes: [string, Partial<LabelLayoutInput>][] = [
      ['plain-qr', {}],
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
