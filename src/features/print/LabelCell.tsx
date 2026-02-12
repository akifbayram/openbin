import type { Bin } from '@/types';
import { resolveIcon } from '@/lib/iconMap';
import { getColorPreset } from '@/lib/colorPalette';
import { getOrientation } from './labelFormats';
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
  const colorPreset = showColorSwatch && bin.color ? getColorPreset(bin.color) : null;
  const barHeight = `${Math.max(2, parseFloat(format.nameFontSize) * 0.45)}pt`;
  const isPortrait = getOrientation(format) === 'portrait';
  const resolvedIconSize = iconSize ?? '8pt';

  return (
    <div
      className={`label-cell flex overflow-hidden ${isPortrait ? 'flex-col items-center' : 'flex-row items-center gap-[4pt]'}`}
      style={{ width: format.cellWidth, height: format.cellHeight, padding: format.padding }}
    >
      {showQrCode && qrDataUrl && (
        <img
          src={qrDataUrl}
          alt=""
          className="shrink-0"
          style={{
            width: format.qrSize,
            height: format.qrSize,
            ...(isPortrait ? { marginBottom: '2pt' } : {}),
          }}
        />
      )}
      <div className={`min-w-0 flex-1 flex flex-col ${isPortrait ? 'items-center text-center w-full' : ''}`}>
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
        {showBinName && (
          <div
            className={`label-name font-semibold truncate flex items-center gap-[2pt] ${isPortrait ? 'justify-center' : ''}`}
            style={{ fontSize: format.nameFontSize }}
          >
            {showIcon && <Icon className="shrink-0" style={{ width: resolvedIconSize, height: resolvedIconSize }} />}
            <span>{bin.name}</span>
          </div>
        )}
        {showLocation && bin.location && (
          <div className="label-contents text-gray-600 line-clamp-2" style={{ fontSize: format.contentFontSize }}>
            {bin.location}
          </div>
        )}
        {showBinCode && bin.short_code && (
          <div
            className="label-code text-gray-700 font-mono font-semibold"
            style={{ fontSize: format.codeFontSize }}
          >
            {bin.short_code}
          </div>
        )}
      </div>
    </div>
  );
}
