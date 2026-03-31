import type { QrStyleOptions } from '@/features/print/usePrintSettings';
import { getBinQrPayload } from './constants';
import { getQRCodeStyling, makeLruCache, type QRColorOptions, rawQrToDataURL } from './qr';

const cache = makeLruCache();

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
  const cached = cache.get(key);
  if (cached) return cached;

  const Ctor = await getQRCodeStyling();
  const payload = getBinQrPayload(binId);

  const bgColor = colorOverride?.light ?? '#ffffff';
  const errorCorrectionLevel = style.errorCorrection;

  const options: ConstructorParameters<typeof Ctor>[0] = {
    width: size,
    height: size,
    type: 'canvas',
    data: payload,
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
  const dataUrl = await rawQrToDataURL(raw);
  cache.set(key, dataUrl);
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
