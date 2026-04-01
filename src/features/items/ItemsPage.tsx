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
            <Skeleton className="h-10 w-full rounded-[var(--radius-full)]" />
            <div className="flat-card rounded-[var(--radius-md)] overflow-hidden">
              <div className="h-9 bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]" />
              <SkeletonList count={6}>
                {() => (
                  <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
                    <Skeleton className="h-5 w-3/4 flex-[2]" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-1/2 flex-1" />
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
