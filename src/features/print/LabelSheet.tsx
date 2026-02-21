import { useState, useEffect } from 'react';
import { batchGenerateQRDataURLs } from '@/lib/qr';
import type { Bin } from '@/types';
import { LabelCell } from './LabelCell';
import type { LabelFormat } from './labelFormats';
import { getLabelFormat, DEFAULT_LABEL_FORMAT, computeLabelsPerPage, computePageSize } from './labelFormats';

interface LabelSheetProps {
  bins: Bin[];
  format?: LabelFormat;
  showColorSwatch?: boolean;
  iconSize?: string;
  showQrCode?: boolean;
  showBinName?: boolean;
  showIcon?: boolean;
  showLocation?: boolean;
  showBinCode?: boolean;
}

export function LabelSheet({ bins, format, showColorSwatch, iconSize, showQrCode, showBinName, showIcon, showLocation, showBinCode }: LabelSheetProps) {
  const labelFormat = format ?? getLabelFormat(DEFAULT_LABEL_FORMAT);
  const qrPixelSize = Math.round(parseFloat(labelFormat.qrSize) * 150);
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bins.length === 0) {
      setQrMap(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    const binIds = bins.map((b) => b.id);
    batchGenerateQRDataURLs(binIds, qrPixelSize).then((result) => {
      if (!cancelled) {
        setQrMap(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setQrMap(new Map());
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bins, qrPixelSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)] text-[13px]">
        Generating labels…
      </div>
    );
  }

  const perPage = computeLabelsPerPage(labelFormat);
  const pages: Bin[][] = [];
  for (let i = 0; i < bins.length; i += perPage) {
    pages.push(bins.slice(i, i + perPage));
  }

  const { width: pageWidth, height: pageHeight } = computePageSize(labelFormat);

  return (
    <>
      <style>{`@media print { @page { size: ${pageWidth}in ${pageHeight}in; margin: 0; } }`}</style>
      {pages.map((pageBins, pageIdx) => (
        <div
          key={pageIdx}
          className="label-page"
          style={{
            width: `${pageWidth}in`,
            height: `${pageHeight}in`,
            boxSizing: 'border-box',
            paddingTop: labelFormat.pageMarginTop,
            paddingBottom: labelFormat.pageMarginBottom,
            paddingLeft: labelFormat.pageMarginLeft,
            paddingRight: labelFormat.pageMarginRight,
            breakAfter: pageIdx < pages.length - 1 ? 'page' : undefined,
          }}
        >
          <div
            className="label-sheet"
            style={{
              gridTemplateColumns: `repeat(${labelFormat.columns}, ${labelFormat.cellWidth})`,
              gridAutoRows: labelFormat.cellHeight,
            }}
          >
            {pageBins.map((bin) => (
              <LabelCell
                key={bin.id}
                bin={bin}
                qrDataUrl={qrMap.get(bin.id) ?? ''}
                format={labelFormat}
                showColorSwatch={showColorSwatch}
                iconSize={iconSize}
                showQrCode={showQrCode}
                showBinName={showBinName}
                showIcon={showIcon}
                showLocation={showLocation}
                showBinCode={showBinCode}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
