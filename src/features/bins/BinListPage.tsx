import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
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
import { haptic, cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/usePermissions';
import { usePaginatedBinList, useAllTags, deleteBin, restoreBin, countActiveFilters } from './useBins';
import { useBinSearchParams } from './useBinSearchParams';
import { pinBin, unpinBin } from '@/features/pins/usePins';

import { BinCard } from './BinCard';
import { BinCreateDialog } from './BinCreateDialog';
import { BinFilterDialog } from './BinFilterDialog';
import { BulkTagDialog } from './BulkTagDialog';
import { BulkAreaDialog } from './BulkAreaDialog';
import { BulkColorDialog } from './BulkColorDialog';
import { BulkIconDialog } from './BulkIconDialog';
import { BulkVisibilityDialog } from './BulkVisibilityDialog';
import { BulkLocationDialog } from './BulkLocationDialog';
import { BulkActionBar } from './BulkActionBar';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';

import { SaveViewDialog } from './SaveViewDialog';
import { useAreaList } from '@/features/areas/useAreas';
import { useAiEnabled } from '@/lib/aiToggle';
import { useTerminology } from '@/lib/terminology';
import { getColorPreset } from '@/lib/colorPalette';
import { useTagStyle } from '@/features/tags/useTagStyle';
import type { Bin } from '@/types';

export function BinListPage() {
  const t = useTerminology();
  const location = useLocation();
  const { search, setSearch, debouncedSearch, sort, setSort, filters, setFilters, clearAll } = useBinSearchParams();

  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Handle create navigation state (ephemeral UI, not shareable)
  useEffect(() => {
    const state = location.state as { create?: boolean } | null;
    if (state?.create) {
      setCreateOpen(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkAreaOpen, setBulkAreaOpen] = useState(false);
  const [bulkColorOpen, setBulkColorOpen] = useState(false);
  const [bulkIconOpen, setBulkIconOpen] = useState(false);
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false);
  const [bulkLocationOpen, setBulkLocationOpen] = useState(false);
  const { activeLocationId } = useAuth();
  const { isAdmin } = usePermissions();
  const { bins, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedBinList(debouncedSearch, sort, filters);
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
  const lastSelectedIndex = useRef<number | null>(null);

  // Clear selection when filters/search/sort reset the list
  useEffect(() => {
    setSelectedIds(new Set());
    lastSelectedIndex.current = null;
  }, [debouncedSearch, sort, filters]);

  const selectable = selectedIds.size > 0;

  // Keyboard shortcuts: Escape to clear selection, Ctrl/Cmd+A to select all
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectable) {
        setSelectedIds(new Set());
        lastSelectedIndex.current = null;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && selectable) {
        e.preventDefault();
        setSelectedIds(new Set(bins.map((b) => b.id)));
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectable, bins]);

  const handleTagClick = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
    }));
  }, [setFilters]);

  const handlePinToggle = useCallback(async (id: string, pinned: boolean) => {
    if (pinned) await pinBin(id);
    else await unpinBin(id);
  }, []);

  const toggleSelect = useCallback((id: string, index: number, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIndex.current !== null) {
        // Range select
        const start = Math.min(lastSelectedIndex.current, index);
        const end = Math.max(lastSelectedIndex.current, index);
        for (let i = start; i <= end; i++) {
          if (bins[i]) next.add(bins[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    lastSelectedIndex.current = index;
  }, [bins]);

  function clearSelection() {
    setSelectedIds(new Set());
    lastSelectedIndex.current = null;
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

  async function bulkPinToggle() {
    const selected = bins.filter((b) => selectedIds.has(b.id));
    const majorityUnpinned = selected.filter((b) => !b.is_pinned).length >= selected.length / 2;
    if (majorityUnpinned) {
      await Promise.all(selected.filter((b) => !b.is_pinned).map((b) => pinBin(b.id)));
    } else {
      await Promise.all(selected.filter((b) => b.is_pinned).map((b) => unpinBin(b.id)));
    }
    clearSelection();
  }

  const pinLabel = (() => {
    const selected = bins.filter((b) => selectedIds.has(b.id));
    const majorityUnpinned = selected.filter((b) => !b.is_pinned).length >= selected.length / 2;
    return majorityUnpinned ? 'Pin' : 'Unpin';
  })();

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
                variant="ghost"
                className="h-10 w-10 rounded-full"
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
              data-shortcut-search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${t.bins}...`}
              className="flex-1 min-w-[80px] bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
            />
            {(hasBadges || search) && (
              <button
                onClick={clearAll}
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
            <>
              <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", selectable && "pb-16")}>
                {bins.map((bin, index) => (
                  <BinCard
                    key={bin.id}
                    bin={bin}
                    index={index}
                    onTagClick={handleTagClick}
                    selectable={selectable}
                    selected={selectedIds.has(bin.id)}
                    onSelect={toggleSelect}
                    searchQuery={debouncedSearch}
                    onPinToggle={handlePinToggle}
                  />
                ))}
              </div>
              <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
            </>
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
      <BulkColorDialog
        open={bulkColorOpen}
        onOpenChange={setBulkColorOpen}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />
      <BulkIconDialog
        open={bulkIconOpen}
        onOpenChange={setBulkIconOpen}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />
      <BulkVisibilityDialog
        open={bulkVisibilityOpen}
        onOpenChange={setBulkVisibilityOpen}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />
      <BulkLocationDialog
        open={bulkLocationOpen}
        onOpenChange={setBulkLocationOpen}
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

      {selectable && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          isAdmin={isAdmin}
          onTag={() => setBulkTagOpen(true)}
          onMove={() => setBulkAreaOpen(true)}
          onDelete={bulkDelete}
          onClear={clearSelection}
          onColor={() => setBulkColorOpen(true)}
          onIcon={() => setBulkIconOpen(true)}
          onVisibility={() => setBulkVisibilityOpen(true)}
          onMoveLocation={() => setBulkLocationOpen(true)}
          onPin={bulkPinToggle}
          pinLabel={pinLabel}
        />
      )}
    </div>
  );
}
