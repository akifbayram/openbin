import { ClipboardList, PackageOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { useTerminology } from '@/lib/terminology';
import { useDebounce } from '@/lib/useDebounce';
import { useTableSearchParams } from '@/lib/useTableSearchParams';
import { cn } from '@/lib/utils';
import { type ItemSortColumn, ItemTableView } from './ItemTableView';
import { usePaginatedItemList } from './useItems';

export function ItemsPage() {
  const t = useTerminology();
  const { search, sortColumn, sortDirection, setSearch, setSort } = useTableSearchParams<ItemSortColumn>('alpha');
  const debouncedSearch = useDebounce(search, 300);
  const { items, totalCount, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedItemList(
    debouncedSearch,
    sortColumn,
    sortDirection,
  );

  return (
    <div className="page-content">
      <PageHeader title="Items" />

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
                      <Skeleton className="h-2 w-2 rounded-full shrink-0" />
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
          <ItemTableView
            items={items}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSortChange={setSort}
            searchQuery={debouncedSearch}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            loadMore={loadMore}
          />
        )}
      </Crossfade>
    </div>
  );
}
