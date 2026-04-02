import { move } from 'piscina';
import sharp from 'sharp';

const THUMB_WIDTH = 600;
const THUMB_QUALITY = 70;

interface FileTask { mode: 'file'; sourcePath: string; destPath: string }
interface BufferTask { mode: 'buffer'; input: Buffer }
type ThumbnailTask = FileTask | BufferTask;

export default async function (task: ThumbnailTask): Promise<Buffer | undefined> {
  const pipeline = sharp(task.mode === 'file' ? task.sourcePath : task.input)
    .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY });

  if (task.mode === 'file') {
    await pipeline.toFile(task.destPath);
    return undefined;
  }
  const buf = await pipeline.toBuffer();
  return move(buf) as Buffer;
}
