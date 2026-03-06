import type { CSSProperties } from 'react';
import { useCallback } from 'react';
import { resolveColor } from '@/lib/colorPalette';
import { useColorMode } from '@/components/ui/color-mode';
import { useTagColorsContext } from './TagColorsContext';

export function useTagStyle(): (tag: string) => CSSProperties | undefined {
  const { tagColors } = useTagColorsContext();
  const { colorMode } = useColorMode();

  return useCallback(
    (tag: string): CSSProperties | undefined => {
      const colorKey = tagColors.get(tag);
      const preset = colorKey ? resolveColor(colorKey) : undefined;
      if (!preset) return undefined;
      return {
        backgroundColor: preset.bgCss,
        color: colorMode === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)',
      };
    },
    [tagColors, colorMode],
  );
}
