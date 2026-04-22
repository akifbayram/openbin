import sharp from 'sharp';
import { createLogger } from './logger.js';

const log = createLogger('aiImageResize');

export async function resizeImageForAi(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (mimeType === 'image/gif') {
    return { buffer, mimeType };
  }
  try {
    const output = await sharp(buffer)
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
