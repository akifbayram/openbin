import { batchGenerateQRDataURLs } from '@/lib/qr';
import { batchRenderIconDataURLs } from './iconToDataUrl';
import { generateLabelPDF } from './generateLabelPDF';
import type { LabelFormat } from './labelFormats';
import { buildColorMap } from './labelFormats';
import type { LabelOptions } from './usePrintSettings';
import type { Bin } from '@/types';

interface DownloadLabelPDFParams {
  bins: Bin[];
  format: LabelFormat;
  labelOptions: LabelOptions;
  iconSize: string;
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
