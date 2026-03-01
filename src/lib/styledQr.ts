import type { QrStyleOptions } from '@/features/print/usePrintSettings';
import { getBinUrl } from './constants';
import type { QRColorOptions } from './qr';

// Module-level import cache — import once, reuse forever
let QRCodeStylingCtor: typeof import('qr-code-styling').default | null = null;

async function getQRCodeStyling() {
  if (!QRCodeStylingCtor) {
    const mod = await import('qr-code-styling');
    QRCodeStylingCtor = mod.default;
  }
  return QRCodeStylingCtor;
}

// LRU cache: key = "binId:size:styleHash", value = data URL string
const MAX_CACHE = 200;
const cache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  const val = cache.get(key);
  if (val !== undefined) {
    cache.delete(key);
    cache.set(key, val);
  }
  return val;
}

function cacheSet(key: string, value: string): void {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function styleHash(style: QrStyleOptions, colorOverride?: QRColorOptions): string {
  return JSON.stringify({ ...style, _co: colorOverride });
}

export async function generateStyledQRDataURL(
  binId: string,
  size: number,
  style: QrStyleOptions,
  colorOverride?: QRColorOptions,
): Promise<string> {
  const key = `${binId}:${size}:${styleHash(style, colorOverride)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const Ctor = await getQRCodeStyling();
  const url = getBinUrl(binId);

  const bgColor = colorOverride?.light ?? '#ffffff';
  const errorCorrectionLevel = style.errorCorrection;

  const options: ConstructorParameters<typeof Ctor>[0] = {
    width: size,
    height: size,
    type: 'canvas',
    data: url,
    margin: 4,
    qrOptions: {
      errorCorrectionLevel,
    },
    dotsOptions: style.useGradient
      ? {
          type: style.dotType,
          gradient: {
            type: style.gradientType,
            rotation: (style.gradientRotation * Math.PI) / 180,
            colorStops: [
              { offset: 0, color: style.gradientColor1 },
              { offset: 1, color: style.gradientColor2 },
            ],
          },
        }
      : {
          type: style.dotType,
          color: style.dotColor,
        },
    backgroundOptions: {
      color: bgColor,
    },
  };

  if (style.cornerSquareType) {
    options.cornersSquareOptions = {
      type: style.cornerSquareType as 'dot' | 'square' | 'extra-rounded',
      color: style.cornerSquareColor || style.dotColor,
    };
  }

  if (style.cornerDotType) {
    options.cornersDotOptions = {
      type: style.cornerDotType as 'dot' | 'square',
      color: style.cornerDotColor || style.dotColor,
    };
  }

  const qr = new Ctor(options);

  const raw = await qr.getRawData('png');
  if (!raw) throw new Error('Failed to generate styled QR code');
  const blob = raw instanceof Blob ? raw : new Blob([new Uint8Array(raw)], { type: 'image/png' });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  cacheSet(key, dataUrl);
  return dataUrl;
}

/**
 * Generate styled QR data URLs for multiple bins with bounded concurrency.
 * Returns a Map<binId, dataUrl>.
 */
export async function batchGenerateStyledQRDataURLs(
  binIds: string[],
  size: number,
  style: QrStyleOptions,
  colorsByBinId?: Map<string, QRColorOptions>,
  concurrency: number = 4,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  let idx = 0;

  async function worker() {
    while (idx < binIds.length) {
      const i = idx++;
      const binId = binIds[i];
      const dataUrl = await generateStyledQRDataURL(binId, size, style, colorsByBinId?.get(binId));
      results.set(binId, dataUrl);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, binIds.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
