import sharp from 'sharp';
import { config } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('aiImageResize');

export async function resizeImageForAi(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const maxDim = config.aiImageMaxDim;
  const quality = config.aiImageWebpQuality;
  try {
    // GIFs always go through to flatten animated frames; non-GIFs already
    // within budget skip the re-encode round-trip.
    if (mimeType !== 'image/gif') {
      const meta = await sharp(buffer).metadata();
      if (meta.width && meta.height && meta.width <= maxDim && meta.height <= maxDim) {
        return { buffer, mimeType };
      }
    }
    const output = await sharp(buffer, { animated: false })
      .resize(maxDim, maxDim, { fit: 'inside' })
      .webp({ quality })
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
