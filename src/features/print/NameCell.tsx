import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import type { Bin } from '@/types';
import type { LabelFormat } from './labelFormats';
import { computeContrastFg, computeNameFontSize, ICON_GAP_RATIO, ICON_SCALE, NAME_CARD_NEUTRAL_BG } from './nameCardLayout';

interface NameCellProps {
  bin: Bin;
  format: LabelFormat;
  showIcon: boolean;
  showColor: boolean;
  /** Pre-computed format dimensions (hoisted from NameSheet to avoid per-cell parsing). */
  cellWPt: number;
  cellHPt: number;
  paddingPt: number;
  overrideFontSizePt?: number;
}

export function NameCell({ bin, format, showIcon, showColor, cellWPt, cellHPt, paddingPt, overrideFontSizePt }: NameCellProps) {
  const displayName = bin.name || bin.short_code;
  const colorPreset = showColor && bin.color ? resolveColor(bin.color) : null;
  const bgColor = colorPreset?.bg;
  const textColor = bgColor ? computeContrastFg(bgColor) : '#000000';
  const Icon = showIcon && bin.icon ? resolveIcon(bin.icon) : null;

  const { fontSizePt, iconSizePt } = overrideFontSizePt != null
    ? { fontSizePt: overrideFontSizePt, iconSizePt: overrideFontSizePt * ICON_SCALE }
    : computeNameFontSize({ cellWidthPt: cellWPt, cellHeightPt: cellHPt, paddingPt, name: displayName, hasIcon: !!Icon });

  return (
    <div
      className="name-cell flex flex-wrap items-center justify-center overflow-hidden"
      style={{
        width: format.cellWidth,
        height: format.cellHeight,
        padding: format.padding,
        backgroundColor: bgColor ?? NAME_CARD_NEUTRAL_BG,
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
        className="min-w-0 font-bold text-center overflow-hidden"
        style={{ fontSize: `${fontSizePt.toFixed(1)}pt`, lineHeight: 1.15, wordBreak: 'break-word' }}
      >
        {displayName}
      </span>
    </div>
  );
}
