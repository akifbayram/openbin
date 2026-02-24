import { batchGenerateQRDataURLs } from '@/lib/qr';
import type { QRColorOptions } from '@/lib/qr';
import { resolveColor } from '@/lib/colorPalette';
import { batchRenderIconDataURLs } from './iconToDataUrl';
import { generateLabelPDF } from './generateLabelPDF';
import type { LabelFormat } from './labelFormats';
import type { LabelOptions } from './usePrintSettings';
import type { Bin } from '@/types';

interface DownloadLabelPDFParams {
  bins: Bin[];
  format: LabelFormat;
  labelOptions: LabelOptions;
  iconSize: string;
}

/** Build a color map for QR generation when color background is enabled. */
function buildColorMap(bins: Bin[], showColorSwatch: boolean): Map<string, QRColorOptions> | undefined {
  if (!showColorSwatch) return undefined;
  const map = new Map<string, QRColorOptions>();
  for (const bin of bins) {
    if (bin.color) {
      const preset = resolveColor(bin.color);
      if (preset) {
        map.set(bin.id, { dark: '#000000', light: preset.bg });
      }
    }
  }
  return map.size > 0 ? map : undefined;
}

export async function downloadLabelPDF(params: DownloadLabelPDFParams): Promise<void> {
  const { bins, format, labelOptions, iconSize } = params;

  // 1. Generate QR data URLs (cache-hit from LRU cache since LabelSheet already generated them)
  const qrPixelSize = Math.round(parseFloat(format.qrSize) * 150);
  const colorMap = buildColorMap(bins, labelOptions.showColorSwatch);
  const qrMap = labelOptions.showQrCode
    ? await batchGenerateQRDataURLs(bins.map((b) => b.id), qrPixelSize, undefined, colorMap)
    : new Map<string, string>();

  // 2. Render icon PNGs (if showIcon enabled)
  let iconMap = new Map<string, string>();
  if (labelOptions.showIcon) {
    const uniqueIcons = [...new Set(bins.map((b) => b.icon))];
    iconMap = await batchRenderIconDataURLs(uniqueIcons, 128);
  }

  // 3. Generate PDF blob
  const blob = await generateLabelPDF({ bins, format, labelOptions, qrMap, iconMap, iconSize });

  // 4. Trigger download via temporary <a> element
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `labels-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
