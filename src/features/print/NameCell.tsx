import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import type { LabelFormat } from './labelFormats';
import { computeContrastFg, computeNameFontSize, ICON_GAP_RATIO, ICON_SCALE } from './nameCardLayout';
import { parsePaddingPt } from './pdfUnits';

/** Neutral background for name cells when color is off (matches PDF fallback). */
const NEUTRAL_BG = 'var(--color-neutral-100, #f5f5f5)';

interface NameCellProps {
  bin: Bin;
  format: LabelFormat;
  showIcon: boolean;
  showColor: boolean;
  overrideFontSizePt?: number;
}

export function NameCell({ bin, format, showIcon, showColor, overrideFontSizePt }: NameCellProps) {
  const displayName = bin.name || bin.id;
  const colorPreset = showColor && bin.color ? resolveColor(bin.color) : null;
  const bgColor = colorPreset?.bg;
  const textColor = bgColor ? computeContrastFg(bgColor) : '#000000';
  const Icon = showIcon && bin.icon ? resolveIcon(bin.icon) : null;

  const pad = parsePaddingPt(format.padding);
  const cellWPt = parseFloat(format.cellWidth) * 72;
  const cellHPt = parseFloat(format.cellHeight) * 72;
  const paddingPt = Math.max(pad.top, pad.bottom, pad.left, pad.right);

  const { fontSizePt, iconSizePt } = overrideFontSizePt != null
    ? { fontSizePt: overrideFontSizePt, iconSizePt: overrideFontSizePt * ICON_SCALE }
    : computeNameFontSize({ cellWidthPt: cellWPt, cellHeightPt: cellHPt, paddingPt, name: displayName, hasIcon: !!Icon });

  return (
    <div
      className={cn('name-cell flex items-center justify-center overflow-hidden')}
      style={{
        width: format.cellWidth,
        height: format.cellHeight,
        padding: format.padding,
        backgroundColor: bgColor ?? NEUTRAL_BG,
        color: textColor,
        gap: `${(fontSizePt * ICON_GAP_RATIO).toFixed(1)}pt`,
      }}
    >
      {Icon && (
        <span className="shrink-0 leading-none">
          <Icon style={{ width: `${iconSizePt.toFixed(1)}pt`, height: `${iconSizePt.toFixed(1)}pt` }} />
        </span>
      )}
      <span
        className="min-w-0 font-bold whitespace-nowrap overflow-hidden text-ellipsis"
        style={{ fontSize: `${fontSizePt.toFixed(1)}pt`, lineHeight: 1.1 }}
      >
        {displayName}
      </span>
    </div>
  );
}
