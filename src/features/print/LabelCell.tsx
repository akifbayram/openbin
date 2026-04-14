import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { BleedLayer } from './BleedLayer';
import type { CellBleed, LabelFormat } from './labelFormats';
import { ZERO_BLEED } from './labelFormats';
import { computeLabelLayout } from './labelLayout';
import type { LabelDirection } from './usePrintSettings';

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
  /** Inches of background-color bleed past each cell edge (for printer alignment tolerance). */
  bleed?: CellBleed;
}

export function LabelCell({ bin, qrDataUrl, format, labelDirection, showColorSwatch, iconSize, showQrCode = true, showBinName = true, showIcon = true, showBinCode = true, textAlign = 'center', bleed = ZERO_BLEED }: LabelCellProps) {
  const Icon = resolveIcon(bin.icon);
  const colorPreset = showColorSwatch && bin.color ? resolveColor(bin.color) : null;
  const resolvedIconSize = iconSize ?? '11pt';

  const layout = computeLabelLayout({
    format,
    hasQrData: !!qrDataUrl,
    hasColor: !!colorPreset,
    hasCode: !!bin.short_code,
    hasIcon: !!bin.icon,
    labelDirection,
    showQrCode,
    showBinName,
    showIcon,
    showBinCode,
    showColorSwatch: !!showColorSwatch,
  });

  const codeFontSize = `${layout.codeFontSizePt.toFixed(1).replace(/\.0$/, '')}pt`;
  const qrCodeFontSize = `${layout.qrCodeFontSizePt.toFixed(1).replace(/\.0$/, '')}pt`;

  const hasQr = showQrCode && qrDataUrl;
  let qrSection: React.ReactNode = null;

  if (hasQr) {
    const qrSizeCSS = `${layout.qrSizePt.toFixed(1)}pt`;
    const qrImage = (
      <div className="relative" style={{ width: qrSizeCSS, height: qrSizeCSS }}>
        <img src={qrDataUrl} alt="" style={{ width: '100%', height: '100%' }} />
        {showIcon && (
          <div
            className="qr-icon-overlay"
            style={{ width: '30%', height: '30%', ...(layout.useColoredCell ? { backgroundColor: colorPreset?.bg } : {}) }}
          >
            <Icon style={{ width: '100%', height: '100%' }} />
          </div>
        )}
      </div>
    );

    const codeLabel = layout.codeUnderQr ? (
      <div
        className="label-code font-mono font-bold"
        style={{ fontSize: qrCodeFontSize }}
      >
        {bin.short_code}
      </div>
    ) : null;

    qrSection = (
      <div
        className={cn('shrink-0 flex flex-col items-center', layout.isPortrait && 'mb-[2pt]')}
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

  const cellClass = cn(
    'label-cell flex overflow-hidden',
    textAlign === 'center' && 'justify-center',
    layout.isPortrait ? 'flex-col' : 'flex-row items-center gap-[4pt]',
    layout.isPortrait && (textAlign === 'center' ? 'items-center' : 'items-start'),
  );

  const showBleed = layout.useColoredCell && !!colorPreset;

  return (
    <div
      className="label-cell-wrapper relative"
      style={{
        width: format.cellWidth,
        height: format.cellHeight,
        overflow: 'visible',
      }}
    >
      {showBleed && <BleedLayer bleed={bleed} color={colorPreset.bg} />}
      <div
        className={cellClass}
        style={{
          width: '100%',
          height: '100%',
          padding: format.padding,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {qrSection}
        <div className={cn('min-w-0 flex flex-col', layout.isPortrait && textAlign === 'center' ? 'items-center text-center w-full' : layout.isPortrait ? 'w-full' : '')}>
          {!layout.codeUnderQr && showBinCode && bin.short_code && (
            <div className="label-code font-mono font-bold" style={{ fontSize: codeFontSize }}>
              {bin.short_code}
            </div>
          )}
          {showBinName && (
            <div
              className={cn('label-name font-semibold', layout.isPortrait && textAlign === 'center' && 'text-center')}
              style={{ fontSize: `${layout.nameFontSizePt.toFixed(1).replace(/\.0$/, '')}pt` }}
            >
              <span className={cn('min-w-0', layout.useColoredCell ? 'line-clamp-2' : 'line-clamp-1')}>{bin.name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
