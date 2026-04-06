import { getBinQrPayload } from './constants';

export const BIN_URL_REGEX = /(?:openbin:\/\/bin\/|https?:\/\/[^/]+(?:\/[^/]+)*\/bin\/)([\w-]{4,36})(?:[/?#]|$)/i;

export const BIN_CODE_REGEX = /^[A-Z0-9]{6}$/;

export interface QRColorOptions {
  dark: string;
  light: string;
}

// Module-level import cache — import once, reuse forever
let QRCodeStylingCtor: typeof import('qr-code-styling').default | null = null;

export async function getQRCodeStyling() {
  if (!QRCodeStylingCtor) {
    const mod = await import('qr-code-styling');
    QRCodeStylingCtor = mod.default;
  }
  return QRCodeStylingCtor;
}

/** Create an LRU cache with get/set helpers. */
export function makeLruCache(maxSize: number = 200) {
  const map = new Map<string, string>();
  return {
    get(key: string): string | undefined {
      const val = map.get(key);
      if (val !== undefined) {
        map.delete(key);
        map.set(key, val);
      }
      return val;
    },
    set(key: string, value: string): void {
      if (map.size >= maxSize) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
      map.set(key, value);
    },
  };
}

/** Convert raw QR output (Blob or ArrayBuffer) to a data URL string. */
export async function rawQrToDataURL(raw: Blob | ArrayBuffer | Buffer): Promise<string> {
  const blob = raw instanceof Blob ? raw : new Blob([raw instanceof ArrayBuffer ? raw : new Uint8Array(raw)], { type: 'image/png' });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const cache = makeLruCache();

export async function generateQRDataURL(
  binId: string,
  size: number = 256,
  colors?: QRColorOptions,
): Promise<string> {
  const dark = colors?.dark ?? '#000000';
  const light = colors?.light ?? '#ffffff';
  const key = `${binId}:${size}:${dark}:${light}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const Ctor = await getQRCodeStyling();
  const payload = getBinQrPayload(binId);
  const qr = new Ctor({
    width: size,
    height: size,
    type: 'canvas',
    data: payload,
    margin: 1,
    dotsOptions: { type: 'square', color: dark },
    backgroundOptions: { color: light },
  });

  const raw = await qr.getRawData('png');
  if (!raw) throw new Error('Failed to generate QR code');
  const dataUrl = await rawQrToDataURL(raw);
  cache.set(key, dataUrl);
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
