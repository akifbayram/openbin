import { describe, expect, it } from 'vitest';
import { compressImage } from '../compressImage';

describe('compressImage', () => {
  it('returns file as-is when under SKIP_THRESHOLD (200KB)', async () => {
    const smallBlob = new Blob(['small image data'], { type: 'image/jpeg' });
    // Default size is well under 200KB
    const result = await compressImage(smallBlob);
    expect(result).toBe(smallBlob);
  });

  it('falls back to returning original file when createImageBitmap is not available', async () => {
    // In jsdom, createImageBitmap and OffscreenCanvas are not available,
    // so the catch block should return the original file
    const content = new Uint8Array(250 * 1024).fill(0); // 250KB, above threshold
    const largeBlob = new Blob([content], { type: 'image/jpeg' });

    const result = await compressImage(largeBlob);
    expect(result).toBe(largeBlob);
  });
});
