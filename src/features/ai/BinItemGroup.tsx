import { CheckSquare } from 'lucide-react';
import { cn, flatCard } from '@/lib/utils';
import { BinGroupHeader } from './BinGroupHeader';
import { ItemRow } from './ItemRow';
import type { QueryMatch } from './useInventoryQuery';
import type { useItemQuerySelection } from './useItemQuerySelection';

type SelectionApi = ReturnType<typeof useItemQuerySelection>;

interface BinItemGroupProps {
  match: QueryMatch;
  canWrite: boolean;
  selection?: SelectionApi;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
}

export function BinItemGroup({ match, canWrite, selection, onBinClick }: BinItemGroupProps) {
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
              <ItemRow
                item={item}
                binId={match.bin_id}
                canWrite={canWrite}
                isTrashed={!!match.is_trashed}
                onOpenBin={(id) => onBinClick(id, match.is_trashed)}
                selected={selection?.isSelected(item.id) ?? false}
                onToggleSelect={
                  selection
                    ? () => selection.toggleItem(item.id, match.bin_id, item.name)
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
      {selection &&
        canWrite &&
        !match.is_trashed &&
        hasItems &&
        !selection.isBinFullySelected(match.bin_id) &&
        selection.isAnySelectedInBin(match.bin_id) && (
          <button
            type="button"
            onClick={() => selection.selectAllInBin(match.bin_id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--bg-hover)] border-t border-[var(--border-subtle)] transition-colors"
          >
            <CheckSquare className="h-4 w-4 shrink-0" />
            <span>Select all {match.items.length} items</span>
          </button>
        )}
    </div>
  );
}
