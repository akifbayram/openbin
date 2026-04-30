import sharp from 'sharp';
import { createLogger } from './logger.js';

const log = createLogger('aiImageResize');

export async function resizeImageForAi(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  // All formats including GIF are resized — sending an unbounded GIF straight
  // through to the provider lets a small upload (under multer's 5MB cap) cost
  // an outsized number of tokens. sharp picks the first frame for animated GIFs.
  try {
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
