import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,MOCK'),
  },
}));

import QRCode from 'qrcode';
import { batchGenerateQRDataURLs, generateQRDataURL } from '@/lib/qr';

describe('generateQRDataURL', () => {
  beforeEach(() => {
    vi.mocked(QRCode.toDataURL).mockClear();
    // Reset module-level cache by generating unique IDs per test
  });

  it('returns a data URL string', async () => {
    const result = await generateQRDataURL('unique-bin-1');
    expect(result).toMatch(/^data:/);
  });

  it('caches results and avoids redundant QRCode.toDataURL calls', async () => {
    const binId = 'cache-test-bin';
    vi.mocked(QRCode.toDataURL).mockClear();

    const first = await generateQRDataURL(binId, 128);
    const second = await generateQRDataURL(binId, 128);

    expect(first).toBe(second);
    expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);
  });
});

describe('batchGenerateQRDataURLs', () => {
  beforeEach(() => {
    vi.mocked(QRCode.toDataURL).mockClear();
  });

  it('returns a Map with all binIds', async () => {
    const ids = ['batch-a', 'batch-b', 'batch-c'];
    const results = await batchGenerateQRDataURLs(ids, 128);

    expect(results).toBeInstanceOf(Map);
    expect(results.size).toBe(3);
    for (const id of ids) {
      expect(results.has(id)).toBe(true);
      expect(results.get(id)).toMatch(/^data:/);
    }
  });

  it('handles more binIds than concurrency limit', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `concurrent-${i}`);
    const results = await batchGenerateQRDataURLs(ids, 128, 3);

    expect(results.size).toBe(10);
    for (const id of ids) {
      expect(results.has(id)).toBe(true);
    }
  });
});
