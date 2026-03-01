import { useNavigate } from 'react-router-dom';
import { Highlight } from '@/components/ui/highlight';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useTerminology } from '@/lib/terminology';
import type { ItemEntry } from './useItems';

export type ItemSortColumn = 'alpha' | 'bin';

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
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div
                  className="hidden sm:block h-2 w-2 rounded-full shrink-0"
                  style={colorPreset ? { backgroundColor: colorPreset.dot } : { backgroundColor: 'var(--text-tertiary)' }}
                />
                <BinIcon className="hidden sm:block h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
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
