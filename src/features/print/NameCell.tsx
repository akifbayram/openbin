import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import type { Bin } from '@/types';
import { BleedLayer } from './BleedLayer';
import type { CellBleed, LabelFormat } from './labelFormats';
import { ZERO_BLEED } from './labelFormats';
import { computeNameFontSize, ICON_GAP_RATIO, ICON_SCALE, NAME_CARD_NEUTRAL_BG } from './nameCardLayout';

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
  /** Inches of background-color bleed past each cell edge. */
  bleed?: CellBleed;
}

export function NameCell({ bin, format, showIcon, showColor, cellWPt, cellHPt, paddingPt, overrideFontSizePt, bleed = ZERO_BLEED }: NameCellProps) {
  const displayName = bin.name || bin.short_code;
  const colorPreset = showColor && bin.color ? resolveColor(bin.color) : null;
  const bgColor = colorPreset?.bg ?? NAME_CARD_NEUTRAL_BG;
  const Icon = showIcon && bin.icon ? resolveIcon(bin.icon) : null;

  const { fontSizePt, iconSizePt } = overrideFontSizePt != null
    ? { fontSizePt: overrideFontSizePt, iconSizePt: overrideFontSizePt * ICON_SCALE }
    : computeNameFontSize({ cellWidthPt: cellWPt, cellHeightPt: cellHPt, paddingPt, name: displayName, hasIcon: !!Icon });

  return (
    <div
      className="name-cell-wrapper relative"
      style={{
        width: format.cellWidth,
        height: format.cellHeight,
        overflow: 'visible',
      }}
    >
      <BleedLayer bleed={bleed} color={bgColor} />
      <div
        className="name-cell flex flex-wrap items-center justify-center overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
          padding: format.padding,
          gap: `${(fontSizePt * ICON_GAP_RATIO).toFixed(1)}pt`,
          position: 'relative',
          zIndex: 1,
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
    </div>
  );
}
