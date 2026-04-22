import { useNavigate } from 'react-router-dom';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Highlight } from '@/components/ui/highlight';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { useEntitySelectionInteraction } from '@/lib/bulk/useEntitySelectionInteraction';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { ItemEntry } from './useItems';

export type ItemSortColumn = 'alpha' | 'bin' | 'qty';

interface ItemTableViewProps {
  items: ItemEntry[];
  sortColumn: ItemSortColumn;
  sortDirection: SortDirection;
  onSortChange: (column: ItemSortColumn, direction: SortDirection) => void;
  searchQuery: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, index: number, shiftKey: boolean) => void;
}

export function ItemTableView({
  items,
  sortColumn,
  sortDirection,
  onSortChange,
  searchQuery,
  hasMore,
  isLoadingMore,
  loadMore,
  selectable,
  selectedIds,
  onSelect,
}: ItemTableViewProps) {
  const t = useTerminology();

  return (
    <>
      <Table>
        {/* Header */}
        <TableHeader>
          <span className="w-6 shrink-0" aria-hidden />
          <SortHeader label="Item" column="alpha" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="flex-[2]" />
          <SortHeader label="Qty" column="qty" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} defaultDirection="desc" className="w-14 justify-end" />
          <SortHeader label={t.Bin} column="bin" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="flex-1" />
        </TableHeader>

        {/* Rows */}
        {items.map((entry, index) => (
          <ItemRow
            key={entry.id}
            entry={entry}
            index={index}
            searchQuery={searchQuery}
            selectable={selectable}
            selected={selectedIds?.has(entry.id) ?? false}
            onSelect={onSelect}
          />
        ))}
      </Table>
      <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
    </>
  );
}

function ItemRow({
  entry,
  index,
  searchQuery,
  selectable,
  selected,
  onSelect,
}: {
  entry: ItemEntry;
  index: number;
  searchQuery: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, index: number, shiftKey: boolean) => void;
}) {
  const navigate = useNavigate();
  const { handleClick, handleKeyDown, longPress } = useEntitySelectionInteraction({
    id: entry.id,
    index,
    selectable,
    onSelect,
    onActivate: () => navigate(`/bin/${entry.bin_id}`, { state: { backLabel: 'Items', backPath: '/items' } }),
  });
  const BinIcon = resolveIcon(entry.bin_icon);
  const colorPreset = resolveColor(entry.bin_color);

  return (
    <TableRow
      tabIndex={0}
      role={selectable ? 'option' : 'button'}
      aria-selected={selectable ? selected : undefined}
      aria-label={`${entry.name}${entry.quantity != null ? ` (${entry.quantity})` : ''} in ${entry.bin_name}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onContextMenu={longPress.onContextMenu}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops row click bubbling */}
      <div
        className={cn('shrink-0 mr-2 transition-opacity', !selectable && !selected && 'opacity-40')}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <Checkbox
          checked={selected ?? false}
          onCheckedChange={() => onSelect?.(entry.id, index, false)}
        />
      </div>
      <div className="flex-[2] min-w-0">
        <span className="truncate font-medium text-[14px] text-[var(--text-primary)]">
          <Highlight text={entry.name} query={searchQuery} />
        </span>
      </div>
      <span className="w-14 shrink-0 text-[13px] tabular-nums text-[var(--text-tertiary)] text-right">
        {entry.quantity != null ? entry.quantity : '—'}
      </span>
      <div className="flex-1 min-w-0 row">
        <BinIconBadge icon={BinIcon} colorPreset={colorPreset} />
        <span className="truncate text-[13px] text-[var(--text-tertiary)]">
          <Highlight text={entry.bin_name} query={searchQuery} />
        </span>
      </div>
    </TableRow>
  );
}
