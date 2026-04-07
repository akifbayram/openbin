import { useNavigate } from 'react-router-dom';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
import { Highlight } from '@/components/ui/highlight';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useTerminology } from '@/lib/terminology';
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
}: ItemTableViewProps) {
  const navigate = useNavigate();
  const t = useTerminology();

  return (
    <>
      <Table>
        {/* Header */}
        <TableHeader>
          <SortHeader label="Item" column="alpha" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="flex-[2]" />
          <SortHeader label="Qty" column="qty" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} defaultDirection="desc" className="w-14 justify-end" />
          <SortHeader label={t.Bin} column="bin" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="flex-1" />
        </TableHeader>

        {/* Rows */}
        {items.map((entry) => {
          const BinIcon = resolveIcon(entry.bin_icon);
          const colorPreset = resolveColor(entry.bin_color);

          return (
            <TableRow
              key={entry.id}
              tabIndex={0}
              role="button"
              aria-label={`${entry.name}${entry.quantity != null ? ` (${entry.quantity})` : ''} in ${entry.bin_name}`}
              onClick={() => navigate(`/bin/${entry.bin_id}`, { state: { backLabel: 'Items', backPath: '/items' } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/bin/${entry.bin_id}`, { state: { backLabel: 'Items', backPath: '/items' } });
              }}
            >
              <div className="flex-[2] min-w-0">
                <span className="truncate font-medium text-[14px] text-[var(--text-primary)]">
                  <Highlight text={entry.name} query={searchQuery} />
                </span>
              </div>
              <span className="w-14 shrink-0 text-[13px] tabular-nums text-[var(--text-tertiary)] text-right">
                {entry.quantity != null ? entry.quantity : '\u2014'}
              </span>
              <div className="flex-1 min-w-0 row">
                <BinIconBadge icon={BinIcon} colorPreset={colorPreset} />
                <span className="truncate text-[13px] text-[var(--text-tertiary)]">
                  <Highlight text={entry.bin_name} query={searchQuery} />
                </span>
              </div>
            </TableRow>
          );
        })}
      </Table>
      <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
    </>
  );
}
