import { ArrowRightLeft, ClipboardList, Hash, PackageOpen, Sparkles, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { useToast } from '@/components/ui/toast';
import { TourLauncher } from '@/features/tour/TourLauncher';
import { type BulkAction, BulkActionBar } from '@/lib/bulk/BulkActionBar';
import { useBulkSelection } from '@/lib/bulk/useBulkSelection';
import { useTerminology } from '@/lib/terminology';
import { useDebounce } from '@/lib/useDebounce';
import { useMountOnOpen } from '@/lib/useMountOnOpen';
import { usePermissions } from '@/lib/usePermissions';
import { useTableSearchParams } from '@/lib/useTableSearchParams';
import { cn } from '@/lib/utils';
import { type ItemSortColumn, ItemTableView } from './ItemTableView';
import { useItemBulkActions } from './useItemBulkActions';
import { usePaginatedItemList } from './useItems';

const BulkDeleteItemsDialog = lazy(() =>
  import('./BulkDeleteItemsDialog').then((m) => ({ default: m.BulkDeleteItemsDialog })),
);
const BulkCheckoutItemsDialog = lazy(() =>
  import('./BulkCheckoutItemsDialog').then((m) => ({ default: m.BulkCheckoutItemsDialog })),
);
const BulkMoveItemsDialog = lazy(() =>
  import('./BulkMoveItemsDialog').then((m) => ({ default: m.BulkMoveItemsDialog })),
);
const BulkQuantityDialog = lazy(() =>
  import('./BulkQuantityDialog').then((m) => ({ default: m.BulkQuantityDialog })),
);

export function ItemsPage() {
  const t = useTerminology();
  const { search, sortColumn, sortDirection, setSearch, setSort } = useTableSearchParams<ItemSortColumn>('alpha');
  const debouncedSearch = useDebounce(search, 300);
  const { items, totalCount, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedItemList(
    debouncedSearch,
    sortColumn,
    sortDirection,
  );

  const { showToast } = useToast();
  const { canWrite } = usePermissions();
  const { selectedIds, selectable, toggleSelect, clearSelection } = useBulkSelection({
    items,
    resetDeps: [debouncedSearch, sortColumn, sortDirection],
  });
  const { bulkDelete, bulkCheckout, bulkMove, bulkQuantity, isBusy } = useItemBulkActions(clearSelection, showToast);

  const [openDialog, setOpenDialog] = useState<'delete' | 'checkout' | 'move' | 'quantity' | null>(null);
  const deleteMounted = useMountOnOpen(openDialog === 'delete');
  const checkoutMounted = useMountOnOpen(openDialog === 'checkout');
  const moveMounted = useMountOnOpen(openDialog === 'move');
  const quantityMounted = useMountOnOpen(openDialog === 'quantity');

  const ids = [...selectedIds];

  const actions: BulkAction[] = [
    { id: 'delete', icon: Trash2, label: 'Delete', onClick: () => setOpenDialog('delete'), group: 'primary', danger: true },
    { id: 'checkout', icon: Sparkles, label: 'Checkout', onClick: () => setOpenDialog('checkout'), group: 'primary' },
    { id: 'move', icon: ArrowRightLeft, label: 'Move', onClick: () => setOpenDialog('move'), group: 'more' },
    { id: 'quantity', icon: Hash, label: 'Set quantity', onClick: () => setOpenDialog('quantity'), group: 'more' },
  ];

  return (
    <div className="page-content-wide">
      <PageHeader title="Items" actions={<TourLauncher tourId="bulk-edit" />} />

      {(totalCount > 0 || search) && (
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={search ? () => setSearch('') : undefined}
          placeholder="Search items..."
        />
      )}

      <Crossfade
        isLoading={isLoading && items.length === 0}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full rounded-[var(--radius-sm)]" />
            <div className="flat-card rounded-[var(--radius-md)] overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]">
                <Skeleton className="h-4 w-10 flex-[2]" />
                <Skeleton className="h-4 w-8 shrink-0" />
                <Skeleton className="h-4 w-8 flex-1" />
              </div>
              <SkeletonList count={6} className="gap-0">
                {(i) => (
                  <div className={cn('px-3 py-2.5 flex items-center gap-3', i < 5 && 'border-b border-[var(--border-subtle)]')}>
                    <Skeleton className={cn('h-4 flex-[2]', i % 3 === 0 ? 'w-2/3' : i % 3 === 1 ? 'w-1/2' : 'w-3/5')} />
                    <Skeleton className="h-4 w-6 shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-[var(--radius-xs)] shrink-0" />
                      <Skeleton className={cn('h-4', i % 2 === 0 ? 'w-1/2' : 'w-2/5')} />
                    </div>
                  </div>
                )}
              </SkeletonList>
            </div>
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={search ? ClipboardList : PackageOpen}
            title={search ? 'No items match your search' : 'No items yet'}
            subtitle={search ? 'Try a different search term' : `Items added to ${t.bins} will appear here`}
            variant={search ? 'search' : undefined}
          >
            {!search && (
              <Link to="/bins">
                <Button variant="secondary" size="sm">Browse {t.bins}</Button>
              </Link>
            )}
          </EmptyState>
        ) : (
          <div data-tour="select-toggle" className={cn(selectable && 'pb-16')}>
            <ItemTableView
              items={items}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={setSort}
              searchQuery={debouncedSearch}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              loadMore={loadMore}
              selectable={selectable}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          </div>
        )}
      </Crossfade>

      {selectable && canWrite && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          isBusy={isBusy}
          actions={actions}
          selectionLabel={`${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'} selected`}
        />
      )}

      {deleteMounted && (
        <Suspense fallback={null}>
          <BulkDeleteItemsDialog
            open={openDialog === 'delete'}
            onOpenChange={(v) => (v ? setOpenDialog('delete') : setOpenDialog(null))}
            count={selectedIds.size}
            onConfirm={() => bulkDelete(ids)}
          />
        </Suspense>
      )}
      {checkoutMounted && (
        <Suspense fallback={null}>
          <BulkCheckoutItemsDialog
            open={openDialog === 'checkout'}
            onOpenChange={(v) => (v ? setOpenDialog('checkout') : setOpenDialog(null))}
            count={selectedIds.size}
            onConfirm={() => bulkCheckout(ids)}
          />
        </Suspense>
      )}
      {moveMounted && (
        <Suspense fallback={null}>
          <BulkMoveItemsDialog
            open={openDialog === 'move'}
            onOpenChange={(v) => (v ? setOpenDialog('move') : setOpenDialog(null))}
            selectedIds={ids}
            onApply={bulkMove}
          />
        </Suspense>
      )}
      {quantityMounted && (
        <Suspense fallback={null}>
          <BulkQuantityDialog
            open={openDialog === 'quantity'}
            onOpenChange={(v) => (v ? setOpenDialog('quantity') : setOpenDialog(null))}
            selectedIds={ids}
            onApply={bulkQuantity}
          />
        </Suspense>
      )}
    </div>
  );
}
