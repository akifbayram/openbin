import { describe, expect, it, vi } from 'vitest';

const mockGetQrConfig = vi.fn().mockReturnValue({ qrPayloadMode: 'app' });
vi.mock('@/lib/qrConfig', () => ({
  getQrConfig: (...args: unknown[]) => mockGetQrConfig(...args),
  initQrConfig: vi.fn(),
}));

import { getBinQrPayload, getBinUrl } from '@/lib/constants';

describe('getBinUrl', () => {
  it('returns correct URL with origin and binId', () => {
    const url = getBinUrl('abc-123');
    expect(url).toBe(`${window.location.origin}/bin/abc-123`);
  });

  it('handles short code binId format', () => {
    const shortCode = 'TBXABC';
    const url = getBinUrl(shortCode);
    expect(url).toBe(`${window.location.origin}/bin/${shortCode}`);
  });
});

describe('getBinQrPayload', () => {
  it('returns openbin:// URI in app mode', () => {
    mockGetQrConfig.mockReturnValue({ qrPayloadMode: 'app' });
    expect(getBinQrPayload('TBXABC')).toBe('openbin://bin/TBXABC');
  });

  it('returns base URL in url mode', () => {
    mockGetQrConfig.mockReturnValue({ qrPayloadMode: 'url', baseUrl: 'https://inventory.example.com' });
    expect(getBinQrPayload('TBXABC')).toBe('https://inventory.example.com/bin/TBXABC');
  });

  it('falls back to openbin:// when url mode has no baseUrl', () => {
    mockGetQrConfig.mockReturnValue({ qrPayloadMode: 'url' });
    expect(getBinQrPayload('TBXABC')).toBe('openbin://bin/TBXABC');
  });

  it('does not include window.location.origin in app mode', () => {
    mockGetQrConfig.mockReturnValue({ qrPayloadMode: 'app' });
    expect(getBinQrPayload('TBXABC')).not.toContain(window.location.origin);
  });
});
