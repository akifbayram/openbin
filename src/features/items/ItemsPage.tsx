import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ClipboardList, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { useDebounce } from '@/lib/useDebounce';
import { usePaginatedItemList } from './useItems';
import { resolveIcon } from '@/lib/iconMap';
import { resolveColor } from '@/lib/colorPalette';
import { useTerminology } from '@/lib/terminology';

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
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-2xl mx-auto">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Items
      </h1>

      {(totalCount > 0 || search) && (
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="pl-10 rounded-[var(--radius-full)] h-10 text-[15px]"
            />
          </div>
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
          <div className="flex flex-col gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <ClipboardList className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              {search ? 'No items match your search' : 'No items yet'}
            </p>
            {!search && (
              <p className="text-[13px]">Items added to {t.bins} will appear here</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((entry) => {
            const Icon = resolveIcon(entry.bin_icon);
            const colorPreset = entry.bin_color
              ? resolveColor(entry.bin_color)
              : null;
            const dotColor = colorPreset?.bgCss ?? null;

            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/bin/${entry.bin_id}`, { state: { backLabel: 'Items', backPath: '/items' } })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/bin/${entry.bin_id}`, { state: { backLabel: 'Items', backPath: '/items' } });
                }}
                className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 cursor-pointer transition-all duration-200 active:scale-[0.98] hover:bg-[var(--bg-hover)]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-[var(--text-primary)] truncate">
                    {entry.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {dotColor && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                    )}
                    <Icon className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
                    <span className="text-[13px] text-[var(--text-tertiary)] truncate">
                      {entry.bin_name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
        </div>
      )}
    </div>
  );
}
