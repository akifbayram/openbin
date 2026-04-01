import type { CSSProperties } from 'react';
import { useCallback } from 'react';
import { getTagTextColor, resolveColor } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';
import { useTagColorsContext } from './TagColorsContext';

export function useTagStyle(): (tag: string) => CSSProperties | undefined {
  const { tagColors } = useTagColorsContext();
  const { theme } = useTheme();

  return useCallback(
    (tag: string): CSSProperties | undefined => {
      const colorKey = tagColors.get(tag);
      const preset = colorKey ? resolveColor(colorKey) : undefined;
      if (!preset) return undefined;
      return {
        backgroundColor: preset.bgCss,
        color: getTagTextColor(preset, theme),
      };
    },
    [tagColors, theme],
  );
}
