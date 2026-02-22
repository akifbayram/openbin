import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import {
  Plus,
  PackageOpen,
  MapPin,
  Sparkles,
  ScanLine,
} from 'lucide-react';

const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/usePermissions';
import { usePaginatedBinList, useAllTags, countActiveFilters } from './useBins';
import { useBinSearchParams } from './useBinSearchParams';
import { pinBin, unpinBin } from '@/features/pins/usePins';

import { BinCard } from './BinCard';
import { BinCreateDialog } from './BinCreateDialog';
import { BinFilterDialog } from './BinFilterDialog';
import { BinSearchBar } from './BinSearchBar';
import { BulkTagDialog } from './BulkTagDialog';
import { BulkAreaDialog } from './BulkAreaDialog';
import { BulkAppearanceDialog } from './BulkAppearanceDialog';
import { BulkVisibilityDialog } from './BulkVisibilityDialog';
import { BulkLocationDialog } from './BulkLocationDialog';
import { BulkActionBar } from './BulkActionBar';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';

import { SaveViewDialog } from './SaveViewDialog';
import { useAreaList } from '@/features/areas/useAreas';
import { useAiEnabled } from '@/lib/aiToggle';
import { useTerminology } from '@/lib/terminology';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { useBulkDialogs } from './useBulkDialogs';
import { useBulkSelection } from './useBulkSelection';
import { useBulkActions } from './useBulkActions';

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
  const hasBadges = activeCount > 0 || !!filters.needsOrganizing;

  const bulk = useBulkDialogs();
  const { selectedIds, selectable, toggleSelect, clearSelection } = useBulkSelection(bins, [debouncedSearch, sort, filters]);
  const { bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel } = useBulkActions(bins, selectedIds, clearSelection, showToast, t);

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

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          {t.Bins}
        </h1>
        {activeLocationId && (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Button
                onClick={() => navigate('/scan')}
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full"
                aria-label="Scan QR code"
              >
                <ScanLine className="h-5 w-5" />
              </Button>
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
            </div>
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
        <BinSearchBar
          search={search}
          setSearch={setSearch}
          filters={filters}
          setFilters={setFilters}
          clearAll={clearAll}
          areas={areas}
          getTagStyle={getTagStyle}
          activeCount={activeCount}
          hasBadges={hasBadges}
          onOpenFilter={() => setFilterOpen(true)}
          t={t}
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

      <BinCreateDialog open={createOpen} onOpenChange={setCreateOpen} allTags={allTags} />
      <BinFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onFiltersChange={setFilters}
        availableTags={allTags}
        areas={areas}
        sort={sort}
        onSortChange={setSort}
        searchQuery={search}
        onSaveView={() => setSaveViewOpen(true)}
      />
      <BulkTagDialog
        open={bulk.isOpen('tag')}
        onOpenChange={(v) => v ? bulk.open('tag') : bulk.close()}
        binIds={[...selectedIds]}
        onDone={clearSelection}
        allTags={allTags}
      />
      <BulkAreaDialog
        open={bulk.isOpen('area')}
        onOpenChange={(v) => v ? bulk.open('area') : bulk.close()}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />
      <BulkAppearanceDialog
        open={bulk.isOpen('appearance')}
        onOpenChange={(v) => v ? bulk.open('appearance') : bulk.close()}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />
      <BulkVisibilityDialog
        open={bulk.isOpen('visibility')}
        onOpenChange={(v) => v ? bulk.open('visibility') : bulk.close()}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />
      <BulkLocationDialog
        open={bulk.isOpen('location')}
        onOpenChange={(v) => v ? bulk.open('location') : bulk.close()}
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
          onTag={() => bulk.open('tag')}
          onMove={() => bulk.open('area')}
          onDelete={bulkDelete}
          onClear={clearSelection}
          onAppearance={() => bulk.open('appearance')}
          onVisibility={() => bulk.open('visibility')}
          onMoveLocation={() => bulk.open('location')}
          onPin={bulkPinToggle}
          onDuplicate={bulkDuplicate}
          pinLabel={pinLabel}
        />
      )}
    </div>
  );
}
