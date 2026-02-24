import type { Bin } from '@/types';
import { resolveIcon } from '@/lib/iconMap';
import { resolveColor } from '@/lib/colorPalette';
import { getOrientation, computeCodeFontSize } from './labelFormats';
import { parsePaddingPt } from './pdfUnits';
import type { LabelFormat } from './labelFormats';

interface LabelCellProps {
  bin: Bin;
  qrDataUrl: string;
  format: LabelFormat;
  showColorSwatch?: boolean;
  iconSize?: string;
  showQrCode?: boolean;
  showBinName?: boolean;
  showIcon?: boolean;
  showLocation?: boolean;
  showBinCode?: boolean;
}

export function LabelCell({ bin, qrDataUrl, format, showColorSwatch, iconSize, showQrCode = true, showBinName = true, showIcon = true, showLocation = true, showBinCode = true }: LabelCellProps) {
  const Icon = resolveIcon(bin.icon);
  const colorPreset = showColorSwatch && bin.color ? resolveColor(bin.color) : null;
  const barHeight = `${Math.max(2, parseFloat(format.nameFontSize) * 0.45)}pt`;
  const isPortrait = getOrientation(format) === 'portrait';
  const resolvedIconSize = iconSize ?? '11pt';
  const codeFontSize = `${computeCodeFontSize(format).toFixed(1).replace(/\.0$/, '')}pt`;
  const qrSizePt = parseFloat(format.qrSize) * 72;
  // Font size so 6 monospace chars span the QR width: each ~0.6em + 0.2em letter-spacing × 5 gaps
  const qrCodeFontSizePt = qrSizePt / (6 * 0.6 + 5 * 0.2);
  const qrCodeFontSize = `${qrCodeFontSizePt.toFixed(1).replace(/\.0$/, '')}pt`;
  const codeUnderQr = showQrCode && qrDataUrl && showBinCode && bin.id;

  // Colored card mode: QR + short code wrapped in a card layout (with or without bg color)
  const useColoredCard = !!showColorSwatch && showQrCode && !!qrDataUrl;
  // Scale card padding: 7% of QR size, minimum 3pt — clamped to fit within the cell's content area
  const idealPadPt = Math.max(3, qrSizePt * 0.07);
  const pad = parsePaddingPt(format.padding);
  const contentHeightPt = parseFloat(format.cellHeight) * 72 - pad.top - pad.bottom;
  const codeHeightPt = (showBinCode && bin.id) ? qrCodeFontSizePt : 0;
  const maxCardPadPt = Math.max(0, (contentHeightPt - qrSizePt - codeHeightPt) / 2);
  const cardPaddingPt = Math.min(idealPadPt, maxCardPadPt);
  const cardPadding = `${cardPaddingPt.toFixed(1).replace(/\.0$/, '')}pt`;
  const cellWPt = parseFloat(format.cellWidth) * 72;
  const cellHPt = parseFloat(format.cellHeight) * 72;
  const borderRadius = `${(Math.min(cellWPt, cellHPt) * 0.08).toFixed(1)}pt`;


  if (useColoredCard) {
    // Colored card layout
    return (
      <div
        className={`label-cell flex justify-center overflow-hidden ${isPortrait ? 'flex-col items-center' : 'flex-row items-center gap-[4pt]'}`}
        style={{ width: format.cellWidth, height: format.cellHeight, padding: format.padding }}
      >
        {/* Colored card wrapping QR + short code */}
        <div
          className={`label-qr-card shrink-0 flex flex-col items-center ${isPortrait ? 'mb-[2pt]' : ''}`}
          style={{
            ...(colorPreset ? { backgroundColor: colorPreset.bg } : {}),
            borderRadius,
            padding: cardPadding,
          }}
        >
          <div className="relative" style={{ width: format.qrSize, height: format.qrSize }}>
            <img src={qrDataUrl} alt="" style={{ width: '100%', height: '100%' }} />
            {showIcon && (
              <div className="qr-icon-overlay" style={{ width: '30%', height: '30%', backgroundColor: colorPreset?.bg ?? 'white' }}>
                <Icon style={{ width: '100%', height: '100%' }} />
              </div>
            )}
          </div>
          {showBinCode && bin.id && (
            <div
              className="label-code font-mono font-bold text-center"
              style={{ fontSize: qrCodeFontSize, width: format.qrSize }}
            >
              {bin.id}
            </div>
          )}
        </div>

        {/* Text column — bin name (large), area */}
        <div className={`min-w-0 flex flex-col ${isPortrait ? 'items-center text-center w-full' : ''}`}>
          {showBinName && (
            <div
              className={`label-name font-semibold ${isPortrait ? 'text-center' : ''}`}
              style={{ fontSize: format.nameFontSize }}
            >
              <span className="min-w-0 line-clamp-2">{bin.name}</span>
            </div>
          )}
          {showLocation && bin.area_name && (
            <div className="label-contents text-gray-600 line-clamp-1" style={{ fontSize: format.contentFontSize }}>
              {bin.area_name}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Non-colored path: unchanged plain layout
  return (
    <div
      className={`label-cell flex justify-center overflow-hidden ${isPortrait ? 'flex-col items-center' : 'flex-row items-center gap-[4pt]'}`}
      style={{ width: format.cellWidth, height: format.cellHeight, padding: format.padding }}
    >
      {showQrCode && qrDataUrl ? (
        <div className={`shrink-0 flex flex-col items-center ${isPortrait ? 'mb-[2pt]' : ''}`}>
          <div className="relative" style={{ width: format.qrSize, height: format.qrSize }}>
            <img src={qrDataUrl} alt="" style={{ width: '100%', height: '100%' }} />
            {showIcon && (
              <div className="qr-icon-overlay" style={{ width: '30%', height: '30%' }}>
                <Icon style={{ width: '100%', height: '100%' }} />
              </div>
            )}
          </div>
          {codeUnderQr && (
            <div
              className="label-code text-gray-700 font-mono font-bold text-center"
              style={{ fontSize: qrCodeFontSize, width: format.qrSize }}
            >
              {bin.id}
            </div>
          )}
        </div>
      ) : showIcon ? (
        <div className="shrink-0" style={{ lineHeight: 1, ...(isPortrait ? { marginBottom: '2pt' } : {}) }}>
          <Icon style={{ width: resolvedIconSize, height: resolvedIconSize }} />
        </div>
      ) : null}
      <div className={`min-w-0 flex flex-col ${isPortrait ? 'items-center text-center w-full' : ''}`}>
        {colorPreset && (
          <div
            className="color-swatch-print rounded-[1pt] w-full shrink-0"
            style={{
              height: barHeight,
              backgroundColor: colorPreset.bg,
              marginBottom: '1pt',
            }}
          />
        )}
        {!codeUnderQr && showBinCode && bin.id && (
          <div
            className="label-code text-gray-700 font-mono font-bold"
            style={{ fontSize: codeFontSize }}
          >
            {bin.id}
          </div>
        )}
        {showBinName && (
          <div
            className={`label-name font-semibold ${isPortrait ? 'text-center' : ''}`}
            style={{ fontSize: format.nameFontSize }}
          >
            <span className="min-w-0 line-clamp-1">{bin.name}</span>
          </div>
        )}
        {showLocation && bin.area_name && (
          <div className="label-contents text-gray-600 line-clamp-1" style={{ fontSize: format.contentFontSize }}>
            {bin.area_name}
          </div>
        )}
      </div>
    </div>
  );
}
