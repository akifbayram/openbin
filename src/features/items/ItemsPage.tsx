import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowUpDown } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { useDebounce } from '@/lib/useDebounce';
import { usePaginatedItemList } from './useItems';
import { useTerminology } from '@/lib/terminology';
import { PageHeader } from '@/components/ui/page-header';

type SortOption = 'alpha' | 'bin';
const sortLabels: Record<SortOption, (binLabel: string) => string> = {
  alpha: () => 'A\u2013Z',
  bin: (binLabel) => `By ${binLabel}`,
};

export function ItemsPage() {
  const t = useTerminology();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('alpha');
  const debouncedSearch = useDebounce(search, 300);
  const navigate = useNavigate();
  const { items, totalCount, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedItemList(debouncedSearch, sort);
  function cycleSort() {
    setSort((prev) => (prev === 'alpha' ? 'bin' : 'alpha'));
  }

  return (
    <div className="page-content">
      <PageHeader title="Items" />

      {(totalCount > 0 || search) && (
        <div className="flex items-center gap-2.5">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            containerClassName="flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={cycleSort}
            className="shrink-0 rounded-[var(--radius-full)] gap-1.5 h-10 px-3.5"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="text-[13px] truncate">{sortLabels[sort](t.Bin)}</span>
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full rounded-[var(--radius-full)]" />
          <SkeletonList>
            {() => (
              <div className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            )}
          </SkeletonList>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search ? 'No items match your search' : 'No items yet'}
          subtitle={search ? undefined : `Items added to ${t.bins} will appear here`}
        />
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((entry) => (
              <ListItem
                key={entry.id}
                interactive
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/bin/${entry.bin_id}`, { state: { backLabel: 'Items', backPath: '/items' } })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/bin/${entry.bin_id}`, { state: { backLabel: 'Items', backPath: '/items' } });
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-[var(--text-primary)] truncate">
                    {entry.name}
                  </p>
                  <span className="text-[13px] text-[var(--text-tertiary)] truncate mt-0.5 block">
                    {entry.bin_name}
                  </span>
                </div>
              </ListItem>
            ))}
          <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
        </div>
      )}
    </div>
  );
}
