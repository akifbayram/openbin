const MAX_DIMENSION = 1920;
const QUALITY = 0.85;
const SKIP_THRESHOLD = 200 * 1024; // 200 KB

/** MIME types we can re-encode on a canvas. GIFs (animated) are skipped entirely. */
const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressImage(file: Blob): Promise<Blob> {
  if (file.size <= SKIP_THRESHOLD) return file;

  if (!COMPRESSIBLE_TYPES.has(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    let targetW = width;
    let targetH = height;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      targetW = Math.round(width * scale);
      targetH = Math.round(height * scale);
    }

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const compressed = await canvas.convertToBlob({
      type: file.type,
      quality: QUALITY,
    });

    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}
