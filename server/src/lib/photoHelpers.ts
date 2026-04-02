import { generateThumbnailFile } from './thumbnailPool.js';

/** Shared thumbnail config: 600px width, WebP 70% quality. */
export async function generateThumbnail(sourcePath: string, destPath: string): Promise<void> {
  await generateThumbnailFile(sourcePath, destPath);
}
