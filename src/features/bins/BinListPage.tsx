import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import {
  Search,
  Plus,
  PackageOpen,
  SlidersHorizontal,
  MapPin,
  Bookmark,
  Sparkles,
} from 'lucide-react';

const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { haptic } from '@/lib/utils';
import { useDebounce } from '@/lib/useDebounce';
import { useAuth } from '@/lib/auth';
import { useBinList, useAllTags, deleteBin, restoreBin, countActiveFilters, EMPTY_FILTERS, type SortOption, type BinFilters } from './useBins';
import { pinBin, unpinBin } from '@/features/pins/usePins';

import { BinCard } from './BinCard';
import { BinCreateDialog } from './BinCreateDialog';
import { BinFilterDialog } from './BinFilterDialog';
import { BulkTagDialog } from './BulkTagDialog';
import { BulkAreaDialog } from './BulkAreaDialog';
import { FilterBadgesBar } from './FilterBadgesBar';
import { BulkActionBar } from './BulkActionBar';
import { SortMenu } from './SortMenu';
import { SaveViewDialog } from './SaveViewDialog';
import { useAreaList } from '@/features/areas/useAreas';
import { useAiEnabled } from '@/lib/aiToggle';
import type { SavedView } from '@/lib/savedViews';
import type { Bin } from '@/types';

export function BinListPage() {
  const location = useLocation();
  const [search, setSearch] = useState(() => {
    const state = location.state as { search?: string } | null;
    return state?.search || '';
  });

  // Update search/filters when navigating from Tags/Areas/Dashboard pages
  useEffect(() => {
    const state = location.state as { search?: string; areaFilter?: string; needsOrganizing?: boolean; savedView?: SavedView } | null;
    if (state?.savedView) {
      const view = state.savedView;
      setSearch(view.searchQuery);
      setSort(view.sort);
      setFilters(view.filters);
      window.history.replaceState({}, '');
      return;
    }
    if (state?.search) {
      setSearch(state.search);
    }
    if (state?.areaFilter) {
      setFilters((f) => ({ ...f, areas: [state.areaFilter!] }));
    }
    if (state?.needsOrganizing) {
      setFilters((f) => ({ ...f, needsOrganizing: true }));
    }
    if (state?.search || state?.areaFilter || state?.needsOrganizing) {
      // Clear the navigation state so it doesn't persist on refresh
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const debouncedSearch = useDebounce(search, 250);
  const [sort, setSort] = useState<SortOption>('updated');
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<BinFilters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkAreaOpen, setBulkAreaOpen] = useState(false);
  const { activeLocationId } = useAuth();
  const { bins, isLoading } = useBinList(debouncedSearch, sort, filters);
  const allTags = useAllTags();
  const activeCount = countActiveFilters(filters);
  const { areas } = useAreaList(activeLocationId);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { aiEnabled } = useAiEnabled();
  const [commandOpen, setCommandOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);

  const selectable = selectedIds.size > 0;

  const handleTagClick = useCallback((tag: string) => {
    setSearch(tag);
  }, []);

  const handlePinToggle = useCallback(async (id: string, pinned: boolean) => {
    if (pinned) await pinBin(id);
    else await unpinBin(id);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function bulkDelete() {
    const toDelete = bins.filter((b) => selectedIds.has(b.id));
    const snapshots: Bin[] = toDelete.map((b) => ({ ...b }));
    await Promise.all(toDelete.map((b) => deleteBin(b.id)));
    haptic([50, 30, 50]);
    clearSelection();
    showToast({
      message: `Deleted ${snapshots.length} bin${snapshots.length !== 1 ? 's' : ''}`,
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const bin of snapshots) {
            await restoreBin(bin);
          }
        },
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Bins
        </h1>
        {activeLocationId && (
          <div className="flex items-center gap-2">
            {aiEnabled && (
              <Button
                onClick={() => setCommandOpen(true)}
                size="icon"
                className="h-10 w-10 rounded-full bg-[var(--ai-accent)] text-white hover:bg-[var(--ai-accent-hover)] active:scale-[0.97] transition-all"
                aria-label="Ask AI"
              >
                <Sparkles className="h-5 w-5" />
              </Button>
            )}
            <Button
              onClick={() => setCreateOpen(true)}
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="New bin"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Search + Sort (only when a location is active) */}
      {activeLocationId && (
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bins..."
              className="pl-10 rounded-[var(--radius-full)] h-10 text-[15px]"
            />
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setFilterOpen(true)}
            className="shrink-0 h-10 w-10 rounded-full relative"
            aria-label="Filter bins"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-[var(--accent)] text-[10px] font-bold text-white flex items-center justify-center px-1">
                {activeCount}
              </span>
            )}
          </Button>
          <SortMenu sort={sort} onSortChange={setSort} />
          {(search || activeCount > 0) && (
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setSaveViewOpen(true)}
              className="shrink-0 h-10 w-10 rounded-full"
              aria-label="Save current view"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onTag={() => setBulkTagOpen(true)}
          onMove={() => setBulkAreaOpen(true)}
          onDelete={bulkDelete}
          onClear={clearSelection}
        />
      )}

      {/* Active filter indicators */}
      <FilterBadgesBar
        search={search}
        onSearchClear={() => setSearch('')}
        filters={filters}
        onFiltersChange={setFilters}
        activeCount={activeCount}
        areas={areas}
      />

      {/* No location selected prompt */}
      {!activeLocationId ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <MapPin className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              No location selected
            </p>
            <p className="text-[13px]">Create or join a location to start organizing bins</p>
          </div>
          <Button onClick={() => navigate('/settings')} variant="outline" className="rounded-[var(--radius-full)] mt-1">
            <MapPin className="h-4 w-4 mr-2" />
            Manage Locations
          </Button>
        </div>
      ) : (
        <>
          {/* Bin grid */}
          {isLoading && bins.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : bins.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
              <PackageOpen className="h-16 w-16 opacity-40" />
              <div className="text-center space-y-1.5">
                <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
                  {search || activeCount > 0 ? 'No bins match your filters' : 'No bins yet'}
                </p>
                {!search && activeCount === 0 && (
                  <p className="text-[13px]">Create your first bin to get started</p>
                )}
              </div>
              {!search && activeCount === 0 && (
                <Button onClick={() => setCreateOpen(true)} variant="outline" className="rounded-[var(--radius-full)] mt-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Bin
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {bins.map((bin) => (
                <BinCard
                  key={bin.id}
                  bin={bin}
                  onTagClick={handleTagClick}
                  selectable={selectable}
                  selected={selectedIds.has(bin.id)}
                  onSelect={toggleSelect}
                  searchQuery={debouncedSearch}
                  onPinToggle={handlePinToggle}
                />
              ))}
            </div>
          )}
        </>
      )}

      <BinCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <BinFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onFiltersChange={setFilters}
        availableTags={allTags}
      />
      <BulkTagDialog
        open={bulkTagOpen}
        onOpenChange={setBulkTagOpen}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />
      <BulkAreaDialog
        open={bulkAreaOpen}
        onOpenChange={setBulkAreaOpen}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />

      <SaveViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        searchQuery={search}
        sort={sort}
        filters={filters}
      />

      {aiEnabled && (
        <Suspense fallback={null}>
          {commandOpen && <CommandInput open={commandOpen} onOpenChange={setCommandOpen} />}
        </Suspense>
      )}
    </div>
  );
}
