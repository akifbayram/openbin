import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { resolveIcon } from '@/lib/iconMap';
import { getCardRenderProps } from '@/lib/cardStyle';

export function BinPreviewCard({ name, color, items, tags }: {
  name: string;
  color: string;
  items: string[];
  tags: string[];
}) {
  const { theme } = useTheme();
  const renderProps = getCardRenderProps(color, '', theme);
  const { mutedColor } = renderProps;
  const BinIcon = resolveIcon('');

  const secondaryStyle: CSSProperties | undefined = mutedColor ? { color: mutedColor } : undefined;
  const iconStyle: CSSProperties | undefined = mutedColor ? { color: mutedColor } : undefined;

  return (
    <div
      className={cn('max-w-[240px] w-full mx-auto mb-5 rounded-[var(--radius-lg)] px-4 py-3 text-left min-h-[72px]', renderProps.className)}
      style={renderProps.style}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[15px] text-[var(--text-primary)] truncate leading-snug">
            {name || <span>My bin</span>}
          </h3>
          {items.length > 0 && (
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)] line-clamp-1 leading-relaxed" style={secondaryStyle}>
              {items.join(', ')}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 overflow-hidden">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[11px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <BinIcon className="mt-0.5 h-[22px] w-[22px] shrink-0 text-[var(--text-tertiary)]" style={iconStyle} />
      </div>
    </div>
  );
}
