import { batchGenerateQRDataURLs } from '@/lib/qr';
import { batchGenerateStyledQRDataURLs } from '@/lib/styledQr';
import { isDefaultQrStyle, type QrStyleOptions } from './usePrintSettings';

/**
 * Generate QR data URLs for every bin shown on the printable item sheet.
 * Picks styled vs plain generation by style. Returns an empty Map on failure
 * so the sheet still renders (without QRs) instead of getting stuck on "Generating…".
 */
export async function generateItemSheetQrMap(
  binIds: string[],
  sizePx: number,
  style: QrStyleOptions,
): Promise<Map<string, string>> {
  if (binIds.length === 0) return new Map();

  try {
    if (isDefaultQrStyle(style)) {
      return await batchGenerateQRDataURLs(binIds, sizePx);
    }
    return await batchGenerateStyledQRDataURLs(binIds, sizePx, style);
  } catch {
    return new Map();
  }
}
