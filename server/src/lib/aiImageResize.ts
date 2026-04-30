import sharp from 'sharp';
import { createLogger } from './logger.js';

const log = createLogger('aiImageResize');

export async function resizeImageForAi(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    // GIFs always go through to flatten animated frames; non-GIFs already
    // within budget skip the re-encode round-trip.
    if (mimeType !== 'image/gif') {
      const meta = await sharp(buffer).metadata();
      if (meta.width && meta.height && meta.width <= 1024 && meta.height <= 1024) {
        return { buffer, mimeType };
      }
    }
    const output = await sharp(buffer, { animated: false })
      .resize(1024, 1024, { fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer();
    if (output.length >= buffer.length) {
      return { buffer, mimeType };
    }
    return { buffer: output, mimeType: 'image/webp' };
  } catch (err) {
    log.warn('falling back to original buffer', err);
    return { buffer, mimeType };
  }
}
