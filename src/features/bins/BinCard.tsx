import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';

interface BinCardProps {
  bin: Bin;
  onTagClick?: (tag: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export const BinCard = React.memo(function BinCard({ bin, onTagClick, selectable, selected, onSelect }: BinCardProps) {
  const navigate = useNavigate();

  function handleClick() {
    if (selectable) {
      onSelect?.(bin.id);
    } else {
      navigate(`/bin/${bin.id}`);
    }
  }

  function handleLongPress() {
    if (!selectable) {
      onSelect?.(bin.id);
    }
  }

  return (
    <div
      className={cn(
        'glass-card rounded-[var(--radius-lg)] px-4 py-3.5 cursor-pointer transition-all duration-200 active:scale-[0.98]',
        selected && 'ring-2 ring-[var(--accent)]'
      )}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
    >
      <div className="flex items-start gap-3">
        {selectable ? (
          <div
            className={cn(
              'mt-0.5 h-[22px] w-[22px] shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
              selected
                ? 'bg-[var(--accent)] border-[var(--accent)]'
                : 'border-[var(--text-tertiary)]'
            )}
          >
            {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </div>
        ) : (
          <Package className="h-5 w-5 mt-0.5 text-[var(--text-tertiary)] shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[15px] text-[var(--text-primary)] truncate leading-snug">
            {bin.name}
          </h3>
          {bin.contents && (
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)] line-clamp-2 leading-relaxed">
              {bin.contents}
            </p>
          )}
        </div>
      </div>
      {bin.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pl-8">
          {bin.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer text-[11px] hover:bg-[var(--bg-active)] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (!selectable) onTagClick?.(tag);
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.bin.id === next.bin.id &&
    prev.bin.name === next.bin.name &&
    prev.bin.contents === next.bin.contents &&
    prev.bin.updatedAt === next.bin.updatedAt &&
    prev.selectable === next.selectable &&
    prev.selected === next.selected &&
    prev.onTagClick === next.onTagClick &&
    prev.onSelect === next.onSelect
  );
});
