import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import {
  Search,
  Plus,
  PackageOpen,
  SlidersHorizontal,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react';

const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { BulkActionBar } from './BulkActionBar';

import { SaveViewDialog } from './SaveViewDialog';
import { useAreaList } from '@/features/areas/useAreas';
import { useAiEnabled } from '@/lib/aiToggle';
import { useTerminology } from '@/lib/terminology';
import { getColorPreset } from '@/lib/colorPalette';
import { useTagStyle } from '@/features/tags/useTagStyle';
import type { SavedView } from '@/lib/savedViews';
import type { Bin } from '@/types';

export function BinListPage() {
  const t = useTerminology();
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
  const getTagStyle = useTagStyle();
  const hasBadges = activeCount > 0 || filters.needsOrganizing;

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
      message: `Deleted ${snapshots.length} ${snapshots.length !== 1 ? t.bins : t.bin}`,
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
          {t.Bins}
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
              aria-label={`New ${t.bin}`}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Search + Sort (only when a location is active) */}
      {activeLocationId && (
        <div className="flex items-center gap-2.5">
          {/* Unified search bar with inline filter badges */}
          <div className="flex flex-1 min-w-0 items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--bg-input)] px-3.5 min-h-10 py-1.5 focus-within:ring-2 focus-within:ring-[var(--accent)] transition-all duration-200">
            <Search className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
            {hasBadges && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0 shrink">
                {filters.tags.map((tag) => (
                  <Badge key={`tag-${tag}`} variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]" style={getTagStyle(tag)}>
                    {tag}
                    <button
                      onClick={() => setFilters({ ...filters, tags: filters.tags.filter((t2) => t2 !== tag) })}
                      aria-label={`Remove tag filter ${tag}`}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                {filters.tags.length >= 2 && (
                  <Badge variant="outline" className="py-0.5 shrink-0 text-[11px] text-[var(--text-tertiary)]">
                    {filters.tagMode === 'all' ? 'All tags' : 'Any tag'}
                  </Badge>
                )}
                {filters.areas.map((areaKey) => {
                  const areaName = areaKey === '__unassigned__' ? 'Unassigned' : areas.find((a) => a.id === areaKey)?.name ?? areaKey;
                  return (
                    <Badge key={`area-${areaKey}`} variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]">
                      {areaName}
                      <button
                        onClick={() => setFilters({ ...filters, areas: filters.areas.filter((a) => a !== areaKey) })}
                        aria-label={`Remove area filter ${areaName}`}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  );
                })}
                {filters.colors.map((key) => {
                  const preset = getColorPreset(key);
                  return (
                    <Badge key={`color-${key}`} variant="outline" className="gap-1.5 pr-1.5 py-0.5 shrink-0 text-[11px]">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: preset?.dot }} />
                      {preset?.label ?? key}
                      <button
                        onClick={() => setFilters({ ...filters, colors: filters.colors.filter((c) => c !== key) })}
                        aria-label={`Remove color filter ${preset?.label ?? key}`}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  );
                })}
                {filters.hasItems && (
                  <Badge variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]">
                    Has items
                    <button
                      onClick={() => setFilters({ ...filters, hasItems: false })}
                      aria-label="Remove has items filter"
                      className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
                {filters.hasNotes && (
                  <Badge variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]">
                    Has notes
                    <button
                      onClick={() => setFilters({ ...filters, hasNotes: false })}
                      aria-label="Remove has notes filter"
                      className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
                {filters.needsOrganizing && (
                  <Badge variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]">
                    Needs organizing
                    <button
                      onClick={() => setFilters({ ...filters, needsOrganizing: false })}
                      aria-label="Remove needs organizing filter"
                      className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${t.bins}...`}
              className="flex-1 min-w-[80px] bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
            />
            {(hasBadges || search) && (
              <button
                onClick={() => { setSearch(''); setFilters({ ...EMPTY_FILTERS, needsOrganizing: false }); }}
                aria-label="Clear all filters"
                className="p-1 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-active)] shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setFilterOpen(true)}
            className="shrink-0 h-10 w-10 rounded-full relative"
            aria-label={`Filter ${t.bins}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-[var(--accent)] text-[10px] font-bold text-white flex items-center justify-center px-1">
                {activeCount}
              </span>
            )}
          </Button>
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

      {/* No location selected prompt */}
      {!activeLocationId ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <MapPin className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              {`No ${t.location} selected`}
            </p>
            <p className="text-[13px]">{`Create or join a ${t.location} to start organizing ${t.bins}`}</p>
          </div>
          <Button onClick={() => navigate('/locations')} variant="outline" className="rounded-[var(--radius-full)] mt-1">
            <MapPin className="h-4 w-4 mr-2" />
            {`Manage ${t.Locations}`}
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
                  {search || activeCount > 0 ? `No ${t.bins} match your filters` : `No ${t.bins} yet`}
                </p>
                {!search && activeCount === 0 && (
                  <p className="text-[13px]">{`Create your first ${t.bin} to get started`}</p>
                )}
              </div>
              {!search && activeCount === 0 && (
                <Button onClick={() => setCreateOpen(true)} variant="outline" className="rounded-[var(--radius-full)] mt-1">
                  <Plus className="h-4 w-4 mr-2" />
                  {`Create ${t.Bin}`}
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
        sort={sort}
        onSortChange={setSort}
        searchQuery={search}
        onSaveView={() => setSaveViewOpen(true)}
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
