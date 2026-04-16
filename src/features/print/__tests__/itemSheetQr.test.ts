import { describe, expect, it, vi } from 'vitest';
import { generateItemSheetQrMap } from '../itemSheetQr';
import { DEFAULT_QR_STYLE } from '../usePrintSettings';

vi.mock('@/lib/qr', () => ({
  batchGenerateQRDataURLs: vi.fn(async (ids: string[]) => {
    const map = new Map<string, string>();
    for (const id of ids) map.set(id, `plain:${id}`);
    return map;
  }),
}));

vi.mock('@/lib/styledQr', () => ({
  batchGenerateStyledQRDataURLs: vi.fn(async (ids: string[]) => {
    const map = new Map<string, string>();
    for (const id of ids) map.set(id, `styled:${id}`);
    return map;
  }),
}));

describe('generateItemSheetQrMap', () => {
  it('returns an empty Map when given no bin ids', async () => {
    const map = await generateItemSheetQrMap([], 96, DEFAULT_QR_STYLE);
    expect(map.size).toBe(0);
  });

  it('uses the plain generator when the qr style is default', async () => {
    const map = await generateItemSheetQrMap(['a', 'b'], 96, DEFAULT_QR_STYLE);
    expect(map.get('a')).toBe('plain:a');
    expect(map.get('b')).toBe('plain:b');
  });

  it('uses the styled generator when the qr style is non-default', async () => {
    const nonDefault = { ...DEFAULT_QR_STYLE, dotType: 'dots' as const };
    const map = await generateItemSheetQrMap(['a'], 96, nonDefault);
    expect(map.get('a')).toBe('styled:a');
  });

  it('falls back to an empty Map when generation throws', async () => {
    const { batchGenerateQRDataURLs } = await import('@/lib/qr');
    (batchGenerateQRDataURLs as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const map = await generateItemSheetQrMap(['a'], 96, DEFAULT_QR_STYLE);
    expect(map.size).toBe(0);
  });
});
