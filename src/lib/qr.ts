import QRCode from 'qrcode';
import { getBinUrl } from './constants';

export const BIN_URL_REGEX = /(?:#\/bin\/|\/bin\/)([A-Z0-9]{4,8})/i;

export interface QRColorOptions {
  dark: string;
  light: string;
}

// LRU cache: key = "binId:size:dark:light", value = data URL string
const MAX_CACHE = 200;
const cache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  const val = cache.get(key);
  if (val !== undefined) {
    // refresh recency: delete + re-insert
    cache.delete(key);
    cache.set(key, val);
  }
  return val;
}

function cacheSet(key: string, value: string): void {
  if (cache.size >= MAX_CACHE) {
    // evict oldest (first inserted)
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

export async function generateQRDataURL(
  binId: string,
  size: number = 256,
  colors?: QRColorOptions,
): Promise<string> {
  const dark = colors?.dark ?? '#000000';
  const light = colors?.light ?? '#ffffff';
  const key = `${binId}:${size}:${dark}:${light}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = getBinUrl(binId);
  const dataUrl = await QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    color: { dark, light },
  });
  cacheSet(key, dataUrl);
  return dataUrl;
}

/**
 * Generate QR data URLs for multiple bins with bounded concurrency.
 * Returns a Map<binId, dataUrl>.
 */
export async function batchGenerateQRDataURLs(
  binIds: string[],
  size: number = 256,
  concurrency: number = 6,
  colorsByBinId?: Map<string, QRColorOptions>,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  let idx = 0;

  async function worker() {
    while (idx < binIds.length) {
      const i = idx++;
      const binId = binIds[i];
      const dataUrl = await generateQRDataURL(binId, size, colorsByBinId?.get(binId));
      results.set(binId, dataUrl);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, binIds.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
