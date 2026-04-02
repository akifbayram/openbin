import { availableParallelism } from 'node:os';
import { Piscina } from 'piscina';

let pool: Piscina | null = null;

// When running from TypeScript source (dev/test via tsx), workers need the tsx loader
// and the .ts filename. In production (compiled dist/), plain .js is used.
const isSource = !import.meta.url.includes('/dist/');
const workerFile = isSource ? './thumbnailWorker.ts' : './thumbnailWorker.js';

function getPool(): Piscina {
  if (!pool) {
    pool = new Piscina({
      filename: new URL(workerFile, import.meta.url).href,
      ...(isSource && { execArgv: ['--import', 'tsx'] }),
      minThreads: 1,
      maxThreads: Math.max(2, Math.floor(availableParallelism() / 2)),
      idleTimeout: 30_000,
      concurrentTasksPerWorker: 1,
    });
  }
  return pool;
}

/** Generate a thumbnail from a file path, writing result to destPath. */
export async function generateThumbnailFile(sourcePath: string, destPath: string): Promise<void> {
  await getPool().run({ mode: 'file', sourcePath, destPath });
}

/** Generate a thumbnail from a Buffer, returning the result Buffer. */
export async function generateThumbnailBuffer(input: Buffer): Promise<Buffer> {
  return getPool().run({ mode: 'buffer', input });
}

/** Drain in-flight tasks and shut down the worker pool. Safe to call if pool was never created. */
export async function closeThumbnailPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
