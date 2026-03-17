import type { Bin } from '@/types';
import { generateNamePDF } from './generateNamePDF';
import { batchRenderIconDataURLs } from './iconToDataUrl';
import type { LabelFormat } from './labelFormats';
import type { NameCardOptions } from './usePrintSettings';

interface DownloadNamePDFParams {
  bins: Bin[];
  format: LabelFormat;
  nameCardOptions: NameCardOptions;
}

export async function downloadNamePDF(params: DownloadNamePDFParams): Promise<void> {
  const { bins, format, nameCardOptions } = params;

  // Render icon PNGs (if showIcon enabled)
  let iconMap = new Map<string, string>();
  if (nameCardOptions.showIcon) {
    const uniqueIcons = [...new Set(bins.map((b) => b.icon))];
    iconMap = await batchRenderIconDataURLs(uniqueIcons, 128);
  }

  // Generate PDF blob
  const blob = await generateNamePDF({ bins, format, nameCardOptions, iconMap });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `name-cards-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
