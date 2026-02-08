const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;
const SKIP_THRESHOLD = 200 * 1024; // 200 KB

export async function compressImage(file: Blob): Promise<Blob> {
  if (file.size <= SKIP_THRESHOLD) return file;

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
      type: 'image/jpeg',
      quality: JPEG_QUALITY,
    });

    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}
