import type { CSSProperties } from 'react';
import { useCallback } from 'react';
import { resolveColor } from '@/lib/colorPalette';
import { useTagColorsContext } from './TagColorsContext';

export function useTagStyle(): (tag: string) => CSSProperties | undefined {
  const { tagColors } = useTagColorsContext();

  return useCallback(
    (tag: string): CSSProperties | undefined => {
      const colorKey = tagColors.get(tag);
      const preset = colorKey ? resolveColor(colorKey) : undefined;
      if (!preset) return undefined;
      return {
        backgroundColor: preset.bgCss,
        color: 'var(--tag-text-on-color)',
      };
    },
    [tagColors],
  );
}
