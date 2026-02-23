import { describe, it, expect } from 'vitest';
import { getBinUrl } from '@/lib/constants';

describe('getBinUrl', () => {
  it('returns correct URL with origin and binId', () => {
    const url = getBinUrl('abc-123');
    expect(url).toBe(`${window.location.origin}/bin/abc-123`);
  });

  it('handles short code binId format', () => {
    const shortCode = 'TBXABC';
    const url = getBinUrl(shortCode);
    expect(url).toContain('/bin/');
    expect(url).toContain(shortCode);
    expect(url).toBe(`${window.location.origin}/bin/${shortCode}`);
  });
});
