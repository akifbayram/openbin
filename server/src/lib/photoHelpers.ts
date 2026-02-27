import sharp from 'sharp';

/** Shared thumbnail config: 600px width, WebP 70% quality. */
export async function generateThumbnail(sourcePath: string, destPath: string): Promise<void> {
  await sharp(sourcePath)
    .resize(600, undefined, { withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(destPath);
}
