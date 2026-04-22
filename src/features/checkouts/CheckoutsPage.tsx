import { ArrowRightLeft, PackageSearch, Undo2 } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { Highlight } from '@/components/ui/highlight';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { type BulkAction, BulkActionBar } from '@/lib/bulk/BulkActionBar';
import { useBulkSelection } from '@/lib/bulk/useBulkSelection';
import { useEntitySelectionInteraction } from '@/lib/bulk/useEntitySelectionInteraction';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useMountOnOpen } from '@/lib/useMountOnOpen';
import { usePermissions } from '@/lib/usePermissions';
import { cn, relativeTime } from '@/lib/utils';
import type { ItemCheckoutWithContext } from '@/types';
import { ReturnItemDialog } from './ReturnItemDialog';
import { useCheckoutBulkActions } from './useCheckoutBulkActions';
import { useLocationCheckouts } from './useCheckouts';

const BulkReturnOriginalDialog = lazy(() =>
  import('./BulkReturnOriginalDialog').then((m) => ({ default: m.BulkReturnOriginalDialog })),
);
const BulkReturnToBinDialog = lazy(() =>
  import('./BulkReturnToBinDialog').then((m) => ({ default: m.BulkReturnToBinDialog })),
);

type CheckoutSortColumn = 'alpha' | 'time';

export function CheckoutsPage() {
  const { activeLocationId } = useAuth();
  const { checkouts, isLoading } = useLocationCheckouts(activeLocationId ?? undefined);
  const { canWrite } = usePermissions();
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

  const { showToast } = useToast();
  const { selectedIds, selectable, toggleSelect, clearSelection } = useBulkSelection<ItemCheckoutWithContext>({
    items: filtered,
    resetDeps: [search, sortColumn, sortDirection],
  });
  const { bulkReturn, bulkReturnToBin, isBusy } = useCheckoutBulkActions(
    activeLocationId ?? null,
    clearSelection,
    showToast,
  );
  const [openBulk, setOpenBulk] = useState<'original' | 'tobin' | null>(null);
  const origMounted = useMountOnOpen(openBulk === 'original');
  const tobinMounted = useMountOnOpen(openBulk === 'tobin');

  const selectedCheckouts = filtered.filter((c) => selectedIds.has(c.id));
  const checkoutIds = selectedCheckouts.map((c) => c.id);

  const bulkActions: BulkAction[] = [
    {
      id: 'return-orig',
      icon: Undo2,
      label: 'Return to original',
      onClick: () => setOpenBulk('original'),
      group: 'primary',
    },
    {
      id: 'return-tobin',
      icon: ArrowRightLeft,
      label: 'Return to bin',
      onClick: () => setOpenBulk('tobin'),
      group: 'primary',
    },
  ];

  return (
    <div className="page-content-wide">
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
          <div className={cn(selectable && 'pb-16')}>
            <p className="text-[13px] text-[var(--text-tertiary)]">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''} checked out
            </p>
            <Table>
              <TableHeader>
                <SortHeader label="Item" column="alpha" currentColumn={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="flex-[2]" />
                <span className="flex-1 ui-col-header">Bin</span>
                <span className="hidden md:block flex-1 ui-col-header">By</span>
                <SortHeader label="Time" column="time" currentColumn={sortColumn} currentDirection={sortDirection} onSort={handleSort} defaultDirection="desc" className="w-20 justify-end" />
                {canWrite && <span className="w-10 shrink-0" />}
              </TableHeader>

              {filtered.map((co, index) => (
                <CheckoutRow
                  key={co.id}
                  co={co}
                  index={index}
                  search={search}
                  canWrite={canWrite}
                  selectable={selectable}
                  selected={selectedIds.has(co.id)}
                  onSelect={toggleSelect}
                  onReturnOne={(c) => setReturningCheckout(c)}
                />
              ))}
            </Table>
          </div>
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

      {selectable && canWrite && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          isBusy={isBusy}
          actions={bulkActions}
          selectionLabel={`${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'} selected`}
        />
      )}
      {origMounted && (
        <Suspense fallback={null}>
          <BulkReturnOriginalDialog
            open={openBulk === 'original'}
            onOpenChange={(v) => (v ? setOpenBulk('original') : setOpenBulk(null))}
            count={selectedCheckouts.length}
            onConfirm={() => bulkReturn(checkoutIds)}
          />
        </Suspense>
      )}
      {tobinMounted && (
        <Suspense fallback={null}>
          <BulkReturnToBinDialog
            open={openBulk === 'tobin'}
            onOpenChange={(v) => (v ? setOpenBulk('tobin') : setOpenBulk(null))}
            checkouts={selectedCheckouts}
            onApply={bulkReturnToBin}
          />
        </Suspense>
      )}
    </div>
  );
}

function CheckoutRow({
  co,
  index,
  search,
  canWrite,
  selectable,
  selected,
  onSelect,
  onReturnOne,
}: {
  co: ItemCheckoutWithContext;
  index: number;
  search: string;
  canWrite: boolean;
  selectable: boolean;
  selected: boolean;
  onSelect: (id: string, index: number, shiftKey: boolean) => void;
  onReturnOne: (co: ItemCheckoutWithContext) => void;
}) {
  const navigate = useNavigate();
  const { handleClick, handleKeyDown, longPress } = useEntitySelectionInteraction({
    id: co.id,
    index,
    selectable,
    onSelect,
    onActivate: () => navigate(`/bin/${co.origin_bin_id}`),
  });
  const BinIcon = resolveIcon(co.origin_bin_icon);
  const colorPreset = resolveColor(co.origin_bin_color);
  return (
    <TableRow
      tabIndex={0}
      role={selectable ? 'option' : 'button'}
      aria-selected={selectable ? selected : undefined}
      aria-label={`${co.item_name} checked out from ${co.origin_bin_name}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onContextMenu={longPress.onContextMenu}
    >
      {selectable && (
        // biome-ignore lint/a11y/noStaticElementInteractions: stops row click propagation to checkbox
        <div className="shrink-0 mr-2" onClick={(e) => e.stopPropagation()} role="presentation">
          <Checkbox checked={selected} onCheckedChange={() => onSelect(co.id, index, false)} />
        </div>
      )}
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
        {relativeTime(co.checked_out_at)}
      </span>
      {canWrite && !selectable && (
        // biome-ignore lint/a11y/noStaticElementInteractions: stops row click propagation to return button
        <div className="w-10 shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()} role="presentation">
          <Tooltip content="Return item">
            <button
              type="button"
              onClick={() => onReturnOne(co)}
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
}
