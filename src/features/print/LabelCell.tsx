import type { Bin } from '@/types';
import { resolveIcon } from '@/lib/iconMap';
import { resolveColor } from '@/lib/colorPalette';
import { computeCodeFontSize } from './labelFormats';
import type { LabelFormat } from './labelFormats';
import type { LabelDirection } from './usePrintSettings';
import { computeLabelLayout } from './labelLayout';

interface LabelCellProps {
  bin: Bin;
  qrDataUrl: string;
  format: LabelFormat;
  labelDirection?: LabelDirection;
  showColorSwatch?: boolean;
  iconSize?: string;
  showQrCode?: boolean;
  showBinName?: boolean;
  showIcon?: boolean;
  showBinCode?: boolean;
  textAlign?: 'left' | 'center';
}

export function LabelCell({ bin, qrDataUrl, format, labelDirection, showColorSwatch, iconSize, showQrCode = true, showBinName = true, showIcon = true, showBinCode = true, textAlign = 'center' }: LabelCellProps) {
  const Icon = resolveIcon(bin.icon);
  const colorPreset = showColorSwatch && bin.color ? resolveColor(bin.color) : null;
  const resolvedIconSize = iconSize ?? '11pt';
  const codeFontSize = `${computeCodeFontSize(format, labelDirection).toFixed(1).replace(/\.0$/, '')}pt`;

  const layout = computeLabelLayout({
    format,
    hasQrData: !!qrDataUrl,
    hasColor: !!bin.color,
    hasCode: !!bin.id,
    hasIcon: !!bin.icon,
    labelDirection,
    showQrCode,
    showBinName,
    showIcon,
    showBinCode,
    showColorSwatch: !!showColorSwatch,
  });

  const qrCodeFontSize = `${layout.qrCodeFontSizePt.toFixed(1).replace(/\.0$/, '')}pt`;
  const cardPadding = `${layout.cardPaddingPt.toFixed(1).replace(/\.0$/, '')}pt`;
  const borderRadius = `${layout.cardRadiusPt.toFixed(1)}pt`;
  const barHeight = `${layout.swatchBarHeightPt.toFixed(1).replace(/\.0$/, '')}pt`;

  // QR block: shared structure for both colored-card and plain modes
  const hasQr = showQrCode && qrDataUrl;
  let qrSection: React.ReactNode = null;

  if (hasQr) {
    const qrImage = (
      <div className="relative" style={{ width: format.qrSize, height: format.qrSize }}>
        <img src={qrDataUrl} alt="" style={{ width: '100%', height: '100%' }} />
        {showIcon && (
          <div
            className="qr-icon-overlay"
            style={{ width: '30%', height: '30%', ...(layout.useColoredCard ? { backgroundColor: colorPreset?.bg ?? 'white' } : {}) }}
          >
            <Icon style={{ width: '100%', height: '100%' }} />
          </div>
        )}
      </div>
    );

    const codeLabel = layout.codeUnderQr ? (
      <div
        className={`label-code font-mono font-bold text-center ${layout.useColoredCard ? '' : 'text-gray-700'}`}
        style={{ fontSize: qrCodeFontSize, width: format.qrSize }}
      >
        {bin.id}
      </div>
    ) : null;

    qrSection = (
      <div
        className={`${layout.useColoredCard ? 'label-qr-card' : ''} shrink-0 flex flex-col items-center ${layout.isPortrait ? 'mb-[2pt]' : ''}`}
        style={layout.useColoredCard ? {
          ...(colorPreset ? { backgroundColor: colorPreset.bg } : {}),
          borderRadius,
          padding: cardPadding,
        } : undefined}
      >
        {qrImage}
        {codeLabel}
      </div>
    );
  } else if (showIcon) {
    qrSection = (
      <div className="shrink-0" style={{ lineHeight: 1, ...(layout.isPortrait ? { marginBottom: '2pt' } : {}) }}>
        <Icon style={{ width: resolvedIconSize, height: resolvedIconSize }} />
      </div>
    );
  }

  const cellClass = `label-cell flex overflow-hidden ${textAlign === 'center' ? 'justify-center' : ''} ${layout.isPortrait ? 'flex-col' : 'flex-row items-center gap-[4pt]'} ${layout.isPortrait ? (textAlign === 'center' ? 'items-center' : 'items-start') : ''}`;

  return (
    <div className={cellClass} style={{ width: format.cellWidth, height: format.cellHeight, padding: format.padding }}>
      {qrSection}
      <div className={`min-w-0 flex flex-col ${layout.isPortrait && textAlign === 'center' ? 'items-center text-center w-full' : layout.isPortrait ? 'w-full' : ''}`}>
        {layout.showSwatchBar && colorPreset && (
          <div
            className="color-swatch-print rounded-[1pt] w-full shrink-0"
            style={{ height: barHeight, backgroundColor: colorPreset.bg, marginBottom: '1pt' }}
          />
        )}
        {!layout.codeUnderQr && showBinCode && bin.id && (
          <div className="label-code text-gray-700 font-mono font-bold" style={{ fontSize: codeFontSize }}>
            {bin.id}
          </div>
        )}
        {showBinName && (
          <div
            className={`label-name font-semibold ${layout.isPortrait && textAlign === 'center' ? 'text-center' : ''}`}
            style={{ fontSize: format.nameFontSize }}
          >
            <span className={`min-w-0 ${layout.useColoredCard ? 'line-clamp-2' : 'line-clamp-1'}`}>{bin.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
