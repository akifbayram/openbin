const MAX_DIMENSION = 1024;
const QUALITY = 0.8;
const OUTPUT_TYPE = 'image/webp';
const AI_COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressImageForAi(file: Blob): Promise<Blob> {
  if (!AI_COMPRESSIBLE_TYPES.has(file.type)) return file;
  if (typeof OffscreenCanvas === 'undefined') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

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
    type: OUTPUT_TYPE,
    quality: QUALITY,
  });

  if (compressed.size >= file.size) return file;
  return compressed;
}
