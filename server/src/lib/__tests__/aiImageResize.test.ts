import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { resizeImageForAi } from '../aiImageResize.js';

describe('resizeImageForAi', () => {
  it('resizes a 2048x1536 JPEG to a 1024 webp with preserved aspect ratio', async () => {
    // Arrange: synthesize a 2048x1536 JPEG input buffer
    const input = await sharp({
      create: {
        width: 2048,
        height: 1536,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .jpeg()
      .toBuffer();

    // Act
    const result = await resizeImageForAi(input, 'image/jpeg');

    // Assert: returns an object with a Buffer and webp mime type
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.mimeType).toBe('image/webp');

    // Assert: decoded output has max dimension of 1024 with aspect ratio preserved (1024x768)
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1024);
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(768);
  });

  it('returns the original buffer when the re-encoded output would be larger', async () => {
    const smallInput = await sharp({
      create: {
        width: 128,
        height: 96,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const result = await resizeImageForAi(smallInput, 'image/png');

    expect(result.mimeType).toBe('image/png');
    expect(result.buffer.equals(smallInput)).toBe(true);
  });

  it('resizes a 2048x1536 GIF down to 1024 webp (no longer bypassed)', async () => {
    const input = await sharp({
      create: {
        width: 2048,
        height: 1536,
        channels: 3,
        background: { r: 50, g: 100, b: 150 },
      },
    })
      .gif()
      .toBuffer();

    const result = await resizeImageForAi(input, 'image/gif');

    expect(result.mimeType).toBe('image/webp');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1024);
  });

  it('returns the original buffer when sharp throws on a malformed input (non-gif mime)', async () => {
    const garbage = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02, 0x03]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await resizeImageForAi(garbage, 'image/jpeg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.buffer).toBe(garbage);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
