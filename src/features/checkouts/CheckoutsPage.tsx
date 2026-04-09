import { PackageSearch, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { Highlight } from '@/components/ui/highlight';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { resolveColor } from '@/lib/colorPalette';
import { formatTimeAgo } from '@/lib/formatTime';
import { resolveIcon } from '@/lib/iconMap';
import { usePermissions } from '@/lib/usePermissions';
import { cn } from '@/lib/utils';
import type { ItemCheckoutWithContext } from '@/types';
import { ReturnItemDialog } from './ReturnItemDialog';
import { useLocationCheckouts } from './useCheckouts';

type CheckoutSortColumn = 'alpha' | 'time';

export function CheckoutsPage() {
  const { activeLocationId } = useAuth();
  const { checkouts, isLoading } = useLocationCheckouts(activeLocationId ?? undefined);
  const { canWrite } = usePermissions();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<CheckoutSortColumn>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [returningCheckout, setReturningCheckout] = useState<ItemCheckoutWithContext | null>(null);

  function handleSort(column: CheckoutSortColumn, direction: SortDirection) {
    setSortColumn(column);
    setSortDirection(direction);
  }

  const filtered = useMemo(() => {
    let list = checkouts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((co) =>
        co.item_name.toLowerCase().includes(q) ||
        co.origin_bin_name.toLowerCase().includes(q) ||
        co.checked_out_by_name.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sortColumn === 'alpha') {
        const cmp = a.item_name.localeCompare(b.item_name);
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      const cmp = a.checked_out_at < b.checked_out_at ? -1 : a.checked_out_at > b.checked_out_at ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [checkouts, search, sortColumn, sortDirection]);

  return (
    <div className="page-content">
      <PageHeader title="Checked Out" />

      {(checkouts.length > 0 || search) && (
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={search ? () => setSearch('') : undefined}
          placeholder="Search items, bins, people..."
        />
      )}

      <Crossfade
        isLoading={isLoading && checkouts.length === 0}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full rounded-[var(--radius-sm)]" />
            <div className="flat-card rounded-[var(--radius-md)] overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]">
                <Skeleton className="h-4 w-10 flex-[2]" />
                <Skeleton className="h-4 w-12 flex-1" />
                <Skeleton className="h-4 w-10 flex-1 hidden md:block" />
                <Skeleton className="h-4 w-12 shrink-0" />
              </div>
              <SkeletonList count={4} className="gap-0">
                {(i) => (
                  <div className={cn('px-3 py-2.5 flex items-center gap-3', i < 3 && 'border-b border-[var(--border-subtle)]')}>
                    <Skeleton className={cn('h-4 flex-[2]', i % 3 === 0 ? 'w-2/3' : i % 3 === 1 ? 'w-1/2' : 'w-3/5')} />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-[var(--radius-xs)] shrink-0" />
                      <Skeleton className={cn('h-4', i % 2 === 0 ? 'w-1/2' : 'w-2/5')} />
                    </div>
                    <Skeleton className="h-4 w-1/3 flex-1 hidden md:block" />
                    <Skeleton className="h-4 w-12 shrink-0" />
                  </div>
                )}
              </SkeletonList>
            </div>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={search ? 'No matches' : 'No items checked out'}
            subtitle={search ? 'Try a different search' : 'Items you check out from bins will appear here'}
          />
        ) : (
          <>
            <p className="text-[13px] text-[var(--text-tertiary)]">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''} checked out
            </p>
            <Table>
              <TableHeader>
                <SortHeader label="Item" column="alpha" currentColumn={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="flex-[2]" />
                <span className="flex-1 text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Bin</span>
                <span className="hidden md:block flex-1 text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">By</span>
                <SortHeader label="Time" column="time" currentColumn={sortColumn} currentDirection={sortDirection} onSort={handleSort} defaultDirection="desc" className="w-20 justify-end" />
                {canWrite && <span className="w-10 shrink-0" />}
              </TableHeader>

              {filtered.map((co) => {
                const BinIcon = resolveIcon(co.origin_bin_icon);
                const colorPreset = resolveColor(co.origin_bin_color);

                return (
                <TableRow
                  key={co.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`${co.item_name} checked out from ${co.origin_bin_name}`}
                  onClick={() => navigate(`/bin/${co.origin_bin_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/bin/${co.origin_bin_id}`);
                  }}
                >
                  <div className="flex-[2] min-w-0">
                    <span className="truncate font-medium text-[14px] text-[var(--text-primary)]">
                      <Highlight text={co.item_name} query={search} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 row">
                    <BinIconBadge icon={BinIcon} colorPreset={colorPreset} />
                    <span className="truncate text-[13px] text-[var(--text-tertiary)]">
                      <Highlight text={co.origin_bin_name} query={search} />
                    </span>
                  </div>
                  <div className="hidden md:block flex-1 min-w-0">
                    <span className="truncate text-[13px] text-[var(--text-tertiary)]">
                      <Highlight text={co.checked_out_by_name} query={search} />
                    </span>
                  </div>
                  <span className="w-20 shrink-0 text-[13px] text-[var(--text-tertiary)] text-right">
                    {formatTimeAgo(co.checked_out_at)}
                  </span>
                  {canWrite && (
                    // biome-ignore lint/a11y/noStaticElementInteractions: stops row click propagation to return button
                    <div className="w-10 shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()} role="presentation">
                      <Tooltip content="Return item">
                        <button
                          type="button"
                          onClick={() => setReturningCheckout(co)}
                          className="shrink-0 p-2 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
                          aria-label={`Return ${co.item_name}`}
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </TableRow>
                );
              })}
            </Table>
          </>
        )}
      </Crossfade>

      {returningCheckout && (
        <ReturnItemDialog
          open
          onOpenChange={(next) => { if (!next) setReturningCheckout(null); }}
          itemName={returningCheckout.item_name}
          binId={returningCheckout.origin_bin_id}
          itemId={returningCheckout.item_id}
          originBinName={returningCheckout.origin_bin_name}
        />
      )}
    </div>
  );
}
