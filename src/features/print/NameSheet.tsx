import type { Bin } from '@/types';
import type { LabelFormat } from './labelFormats';
import { computeLabelsPerPage, computePageSize } from './labelFormats';
import { NameCell } from './NameCell';
import { computeNameFontSize } from './nameCardLayout';
import { parsePaddingPt } from './pdfUnits';

interface NameSheetProps {
  bins: Bin[];
  format: LabelFormat;
  showIcon: boolean;
  showColor: boolean;
  sizingMode: 'auto' | 'uniform';
}

export function NameSheet({ bins, format, showIcon, showColor, sizingMode }: NameSheetProps) {
  // Pre-compute uniform font size if needed
  let uniformFontSizePt: number | undefined;
  if (sizingMode === 'uniform') {
    const pad = parsePaddingPt(format.padding);
    const cellWPt = parseFloat(format.cellWidth) * 72;
    const cellHPt = parseFloat(format.cellHeight) * 72;
    const paddingPt = Math.max(pad.top, pad.bottom, pad.left, pad.right);

    uniformFontSizePt = Math.min(
      ...bins.map((bin) => {
        const displayName = bin.name || bin.id;
        const hasIcon = showIcon && !!bin.icon;
        return computeNameFontSize({ cellWidthPt: cellWPt, cellHeightPt: cellHPt, paddingPt, name: displayName, hasIcon }).fontSizePt;
      }),
    );
  }

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
                overrideFontSizePt={uniformFontSizePt}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
