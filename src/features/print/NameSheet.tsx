import type { Bin } from '@/types';
import type { LabelFormat } from './labelFormats';
import { computeLabelsPerPage, computePageSize } from './labelFormats';
import { NameCell } from './NameCell';
import { computeUniformFontSize, maxPaddingPt } from './nameCardLayout';

interface NameSheetProps {
  bins: Bin[];
  format: LabelFormat;
  showIcon: boolean;
  showColor: boolean;
  sizingMode: 'auto' | 'uniform';
}

export function NameSheet({ bins, format, showIcon, showColor, sizingMode }: NameSheetProps) {
  // Hoist format-derived constants (same for every cell)
  const cellWPt = parseFloat(format.cellWidth) * 72;
  const cellHPt = parseFloat(format.cellHeight) * 72;
  const paddingPt = maxPaddingPt(format.padding);

  // Pre-compute uniform font size if needed
  const uniformFontSizePt = sizingMode === 'uniform'
    ? computeUniformFontSize(bins, cellWPt, cellHPt, paddingPt, showIcon)
    : undefined;

  const perPage = computeLabelsPerPage(format);
  const pages: Bin[][] = [];
  for (let i = 0; i < bins.length; i += perPage) {
    pages.push(bins.slice(i, i + perPage));
  }

  const { width: pageWidth, height: pageHeight } = computePageSize(format);

  return (
    <>
      <style>{`@media print { @page { size: ${pageWidth}in ${pageHeight}in; margin: 0; } }`}</style>
      {pages.map((pageBins, pageIdx) => (
        <div
          key={pageBins[0]?.id ?? pageIdx}
          className="label-page"
          style={{
            width: `${pageWidth}in`,
            height: `${pageHeight}in`,
            boxSizing: 'border-box',
            paddingTop: format.pageMarginTop,
            paddingBottom: format.pageMarginBottom,
            paddingLeft: format.pageMarginLeft,
            paddingRight: format.pageMarginRight,
            breakAfter: pageIdx < pages.length - 1 ? 'page' : undefined,
          }}
        >
          <div
            className="label-sheet"
            style={{
              gridTemplateColumns: `repeat(${format.columns}, ${format.cellWidth})`,
              gridAutoRows: format.cellHeight,
            }}
          >
            {pageBins.map((bin) => (
              <NameCell
                key={bin.id}
                bin={bin}
                format={format}
                showIcon={showIcon}
                showColor={showColor}
                cellWPt={cellWPt}
                cellHPt={cellHPt}
                paddingPt={paddingPt}
                overrideFontSizePt={uniformFontSizePt}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
