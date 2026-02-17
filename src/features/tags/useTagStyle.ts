import { useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useTagColorsContext } from './TagColorsContext';
import { getColorPreset } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';

export function useTagStyle(): (tag: string) => CSSProperties | undefined {
  const { tagColors } = useTagColorsContext();
  const { theme } = useTheme();

  return useCallback(
    (tag: string): CSSProperties | undefined => {
      const colorKey = tagColors.get(tag);
      const preset = colorKey ? getColorPreset(colorKey) : undefined;
      if (!preset) return undefined;
      return {
        backgroundColor: theme === 'dark' ? preset.bgDark : preset.bg,
        color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)',
      };
    },
    [tagColors, theme],
  );
}
