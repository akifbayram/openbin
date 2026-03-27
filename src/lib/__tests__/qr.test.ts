import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,MOCK'),
  },
}));

vi.mock('@/lib/qrConfig', () => ({
  getQrConfig: () => ({ qrPayloadMode: 'app' }),
  initQrConfig: vi.fn(),
}));

import QRCode from 'qrcode';
import { BIN_URL_REGEX, batchGenerateQRDataURLs, generateQRDataURL } from '@/lib/qr';

describe('generateQRDataURL', () => {
  beforeEach(() => {
    vi.mocked(QRCode.toDataURL).mockClear();
  });

  it('returns a data URL string', async () => {
    const result = await generateQRDataURL('unique-bin-1');
    expect(result).toMatch(/^data:/);
  });

  it('encodes the openbin:// URI as QR payload in app mode', async () => {
    vi.mocked(QRCode.toDataURL).mockClear();
    await generateQRDataURL('ABCDEF', 128);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      'openbin://bin/ABCDEF',
      expect.any(Object),
    );
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

describe('BIN_URL_REGEX', () => {
  // openbin:// format
  it('matches openbin:// URI', () => {
    const match = 'openbin://bin/ABCDEF'.match(BIN_URL_REGEX);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('ABCDEF');
  });

  it('is case-insensitive for openbin://', () => {
    const match = 'OPENBIN://BIN/abcdef'.match(BIN_URL_REGEX);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('abcdef');
  });

  // URL format (accepted for backwards compat after mode switch)
  it('matches https URL format', () => {
    const match = 'https://example.com/bin/ABCDEF'.match(BIN_URL_REGEX);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('ABCDEF');
  });

  it('matches http URL format', () => {
    const match = 'http://localhost:1453/bin/ABCDEF'.match(BIN_URL_REGEX);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('ABCDEF');
  });

  it('matches URL with path prefix', () => {
    const match = 'https://example.com/openbin/bin/ABCDEF'.match(BIN_URL_REGEX);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('ABCDEF');
  });

  // Boundary checks
  it('rejects codes shorter than 4 characters', () => {
    expect('openbin://bin/AB'.match(BIN_URL_REGEX)).toBeNull();
  });

  it('rejects non-matching schemes', () => {
    expect('otherapp://bin/ABCDEF'.match(BIN_URL_REGEX)).toBeNull();
  });

  it('rejects /bin/ embedded in longer words', () => {
    expect('https://example.com/cabin/ABCDEF'.match(BIN_URL_REGEX)).toBeNull();
  });

  it('still extracts ID when trailing path segments follow', () => {
    const match = 'https://example.com/bin/ABCDEF/edit'.match(BIN_URL_REGEX);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('ABCDEF');
  });

  it('accepts ID followed by query string', () => {
    const match = 'https://example.com/bin/ABCDEF?ref=qr'.match(BIN_URL_REGEX);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('ABCDEF');
  });
});
