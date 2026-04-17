import type { EnrichedQueryItem } from './useInventoryQuery';

interface ItemRowProps {
  item: EnrichedQueryItem;
  binId: string;
}

export function ItemRow({ item }: ItemRowProps) {
  return (
    <div className="group flex items-center gap-3 px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors">
      <span className="flex-1 min-w-0 text-[14px] text-[var(--text-primary)] truncate">
        {item.name}
      </span>
      {item.quantity != null && (
        <span className="shrink-0 text-[13px] text-[var(--text-tertiary)] tabular-nums">
          ×{item.quantity}
        </span>
      )}
    </div>
  );
}
