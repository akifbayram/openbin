import { PackageSearch, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { formatTimeAgo } from '@/lib/formatTime';
import { usePermissions } from '@/lib/usePermissions';
import { cn, flatCard } from '@/lib/utils';
import type { ItemCheckoutWithContext } from '@/types';
import { returnItem, useLocationCheckouts } from './useCheckouts';

export function CheckoutsPage() {
  const { activeLocationId } = useAuth();
  const { checkouts, isLoading } = useLocationCheckouts(activeLocationId ?? undefined);
  const { canWrite } = usePermissions();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const filtered = useMemo(() => {
    let list = checkouts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((co) =>
        co.item_name.toLowerCase().includes(q) ||
        co.origin_bin_name.toLowerCase().includes(q) ||
        co.checked_out_by_name.toLowerCase().includes(q)
      );
    }
    if (sortDir === 'asc') {
      list = [...list].reverse();
    }
    return list;
  }, [checkouts, search, sortDir]);

  async function handleReturn(co: ItemCheckoutWithContext) {
    try {
      await returnItem(co.origin_bin_id, co.item_id);
      showToast({ message: `${co.item_name} returned` });
    } catch {
      showToast({ message: 'Failed to return item' });
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-4 pb-2 max-w-3xl mx-auto">
      <PageHeader title="Checked Out" />
      <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items, bins, people..." />
      {isLoading ? (
        <SkeletonList count={3}>
          {(i) => (
            <div className={cn('flex items-center gap-3 px-4 py-3', i < 2 && 'border-b border-[var(--border-subtle)]')}>
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          )}
        </SkeletonList>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={search ? 'No matches' : 'No items checked out'}
          subtitle={search ? 'Try a different search' : 'Items you check out from bins will appear here'}
        />
      ) : (
        <div className={cn(flatCard, 'divide-y divide-[var(--border-subtle)]')}>
          <div className="flex items-center justify-between px-4 py-2 text-[13px] text-[var(--text-tertiary)]">
            <span>{filtered.length} item{filtered.length !== 1 ? 's' : ''} checked out</span>
            <SortHeader label="Time" column="time" currentColumn="time" currentDirection={sortDir} onSort={(_col, dir) => setSortDir(dir)} />
          </div>
          {filtered.map((co) => (
            <div key={co.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-[var(--text-primary)] truncate">{co.item_name}</p>
                <p className="text-[13px] text-[var(--text-tertiary)] truncate">
                  <button type="button" onClick={() => navigate(`/bin/${co.origin_bin_id}`)} className="hover:underline">
                    {co.origin_bin_name}
                  </button>
                  {' \u00b7 '}{co.checked_out_by_name}{' \u00b7 '}{formatTimeAgo(co.checked_out_at)}
                </p>
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => handleReturn(co)}
                  className="shrink-0 p-2 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
                  aria-label={`Return ${co.item_name}`}
                >
                  <Undo2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
