import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { resolveIcon } from '@/lib/iconMap';
import { getCardRenderProps } from '@/lib/cardStyle';

export function BinPreviewCard({ name, color, items, tags, icon, cardStyle, areaName }: {
  name: string;
  color: string;
  items: string[];
  tags: string[];
  icon?: string;
  cardStyle?: string;
  areaName?: string;
}) {
  const { theme } = useTheme();
  const renderProps = getCardRenderProps(color, cardStyle ?? '', theme);
  const { mutedColor } = renderProps;
  const BinIcon = resolveIcon(icon ?? '');

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
          {areaName && (
            <p className="text-[12px] text-[var(--text-tertiary)] truncate leading-relaxed" style={secondaryStyle}>
              {areaName}
            </p>
          )}
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
      {renderProps.stripeBar && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            background: renderProps.stripeBar.color,
            ...(renderProps.stripeBar.position === 'left' && { left: 0, top: 0, bottom: 0, width: renderProps.stripeBar.width }),
            ...(renderProps.stripeBar.position === 'right' && { right: 0, top: 0, bottom: 0, width: renderProps.stripeBar.width }),
            ...(renderProps.stripeBar.position === 'top' && { left: 0, top: 0, right: 0, height: renderProps.stripeBar.width }),
            ...(renderProps.stripeBar.position === 'bottom' && { left: 0, bottom: 0, right: 0, height: renderProps.stripeBar.width }),
          }}
        />
      )}
    </div>
  );
}
