const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface CompressOptions {
  maxDimension: number;
  quality: number;
  /** Output blob MIME type. If omitted, preserves `file.type`. */
  outputType?: string;
  /** Skip compression entirely when `file.size` is at or below this value. */
  skipThresholdBytes?: number;
}

export async function compressBlobImage(file: Blob, opts: CompressOptions): Promise<Blob> {
  const { maxDimension, quality, outputType, skipThresholdBytes } = opts;

  if (skipThresholdBytes != null && file.size <= skipThresholdBytes) return file;
  if (!COMPRESSIBLE_TYPES.has(file.type)) return file;
  if (typeof OffscreenCanvas === 'undefined') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const { width, height } = bitmap;
    let targetW = width;
    let targetH = height;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      targetW = Math.round(width * scale);
      targetH = Math.round(height * scale);
    }

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const compressed = await canvas.convertToBlob({
      type: outputType ?? file.type,
      quality,
    });

    return compressed.size < file.size ? compressed : file;
  } finally {
    bitmap.close();
  }
}

const STORAGE_PROFILE: CompressOptions = {
  maxDimension: 1920,
  quality: 0.85,
  skipThresholdBytes: 200 * 1024,
};

export function compressImage(file: Blob): Promise<Blob> {
  return compressBlobImage(file, STORAGE_PROFILE);
}
