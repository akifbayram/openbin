import { cn, flatCard } from '@/lib/utils';
import { BinGroupHeader } from './BinGroupHeader';
import { ItemRow } from './ItemRow';
import type { QueryMatch } from './useInventoryQuery';

interface BinItemGroupProps {
  match: QueryMatch;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
}

export function BinItemGroup({ match, onBinClick }: BinItemGroupProps) {
  const hasItems = match.items.length > 0;
  return (
    <div className={cn(flatCard, 'overflow-hidden rounded-[var(--radius-sm)]')}>
      <BinGroupHeader
        name={match.name}
        areaName={match.area_name}
        icon={match.icon}
        color={match.color}
        isTrashed={!!match.is_trashed}
        onOpen={() => onBinClick(match.bin_id, match.is_trashed)}
      />
      {hasItems && (
        <ul className="border-t border-[var(--border-subtle)]">
          {match.items.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} binId={match.bin_id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
