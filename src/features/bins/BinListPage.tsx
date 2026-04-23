import {
  AlertTriangle,
  MapPin,
  PackageOpen,
  Plus,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import type { SortDirection } from '@/components/ui/sort-header';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { setCommandSelectedBinIds } from '@/features/ai/commandSelectedBins';
import { useAreaList } from '@/features/areas/useAreas';
import { useScanDialog } from '@/features/qrcode/ScanDialogContext';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { getCommandInputRef, useTourContext } from '@/features/tour/TourProvider';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { BulkActionBar } from '@/lib/bulk/BulkActionBar';
import { useBulkSelection } from '@/lib/bulk/useBulkSelection';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import { cn } from '@/lib/utils';
import { BinCard } from './BinCard';
import { BinCompactCard } from './BinCompactCard';
import { BinListDialogs } from './BinListDialogs';
import { BinListSkeleton } from './BinListSkeleton';
import { BinSearchBar } from './BinSearchBar';
import { BinTableView } from './BinTableView';
import { buildBinBulkActions } from './buildBinBulkActions';
import { DeleteBinDialog } from './DeleteBinDialog';
import { SearchBarOverflowMenu } from './SearchBarOverflowMenu';
import { useBinCreateFromCapture } from './useBinCreateFromCapture';
import { useBinSearchParams } from './useBinSearchParams';
import { countActiveFilters, type SortOption, updateBin, useAllTags, usePaginatedBinList } from './useBins';
import { useBulkActions } from './useBulkActions';
import { useBulkDialogs } from './useBulkDialogs';
import { useColumnVisibility } from './useColumnVisibility';
import { useCustomFields } from './useCustomFields';
import { usePageSize } from './usePageSize';
import { useViewMode } from './useViewMode';

const UpgradeDialog = __EE__
  ? lazy(() => import('@/ee/UpgradeDialog').then(m => ({ default: m.UpgradeDialog })))
  : (() => null) as React.FC<Record<string, unknown>>;

export function BinListPage() {
  const t = useTerminology();
  const location = useLocation();
  const { search, setSearch, debouncedSearch, sort, setSort, sortDir, setSortDir, filters, setFilters, page, setPage, clearAll } = useBinSearchParams();

  const { createOpen, setCreateOpen, createInitialPhotos, onCreateInitialPhotosConsumed } =
    useBinCreateFromCapture();
  const [filterOpen, setFilterOpen] = useState(false);
  const tourCtx = useTourContext();

  // Handle navigation state (ephemeral UI, not shareable)
  useEffect(() => {
    const state = location.state as { create?: boolean; startTour?: boolean } | null;
    if (state?.create) {
      setCreateOpen(true);
    }
    if (state?.startTour) {
      tourCtx?.tour.start();
    }
    if (state) window.history.replaceState({}, '');
  }, [location.state, tourCtx, setCreateOpen]);

  const { activeLocationId } = useAuth();
  const prevLocationRef = useRef(activeLocationId);
  useEffect(() => {
    if (prevLocationRef.current && activeLocationId && prevLocationRef.current !== activeLocationId) {
      clearAll();
    }
    prevLocationRef.current = activeLocationId;
  }, [activeLocationId, clearAll]);
  const { isAdmin, canWrite, canCreateBin } = usePermissions();
  const resetPage = useCallback(() => setPage(1), [setPage]);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize(resetPage);
  const { bins, totalCount, totalPages, isLoading, error } = usePaginatedBinList(debouncedSearch, sort, sortDir, filters, page, pageSize, setPage);
  const allTags = useAllTags();
  const activeCount = countActiveFilters(filters);
  const { areas } = useAreaList(activeLocationId);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { openScanDialog } = useScanDialog();
  const { aiEnabled, aiGated } = useAiEnabled();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const getTagStyle = useTagStyle();
  const { viewMode, setViewMode } = useViewMode();
  const { fields: customFields } = useCustomFields(activeLocationId);
  const { visibility, toggleField, applicableFields, isVisible } = useColumnVisibility(
    viewMode,
    viewMode === 'table' ? customFields : undefined,
  );
  const customFieldLabels = useMemo(() => {
    if (!customFields?.length) return undefined;
    const map: Record<string, string> = {};
    for (const f of customFields) map[`cf_${f.id}`] = f.name;
    return map;
  }, [customFields]);
  const hasBadges = activeCount > 0 || !!filters.needsOrganizing;

  const bulk = useBulkDialogs();
  const { selectedIds, selectable, toggleSelect, clearSelection } = useBulkSelection({
    items: bins,
    resetDeps: [debouncedSearch, sort, sortDir, filters],
  });
  const { bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel, isBusy } = useBulkActions(bins, selectedIds, clearSelection, showToast, t);

  const selectedBinIds = useMemo(() => selectedIds.size > 0 ? [...selectedIds] : undefined, [selectedIds]);
  useEffect(() => {
    setCommandSelectedBinIds(selectedBinIds);
    return () => setCommandSelectedBinIds(undefined);
  }, [selectedBinIds]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<{ icon: string; color: string; card_style: string } | null>(null);

  const handleCopyStyle = useCallback(() => {
    const [id] = selectedIds;
    const bin = bins.find((b) => b.id === id);
    if (!bin) return;
    setCopiedStyle({ icon: bin.icon, color: bin.color, card_style: bin.card_style });
    clearSelection();
    showToast({ message: 'Style copied', variant: 'success' });
  }, [selectedIds, bins, clearSelection, showToast]);

  const handlePasteStyle = useCallback(async () => {
    if (!copiedStyle) return;
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => updateBin(id, { icon: copiedStyle.icon, color: copiedStyle.color, cardStyle: copiedStyle.card_style })));
    clearSelection();
    showToast({ message: `Style applied to ${ids.length} ${ids.length === 1 ? t.bin : t.bins}`, variant: 'success' });
  }, [copiedStyle, selectedIds, clearSelection, showToast, t]);

  const handleBinSortChange = useCallback((column: SortOption, direction: SortDirection) => {
    setSort(column);
    setSortDir(direction);
  }, [setSort, setSortDir]);

  const handleTagClick = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
    }));
  }, [setFilters]);

  return (
    <div className="page-content max-w-none">
      {/* Header */}
      <PageHeader
        title={t.Bins}
        actions={activeLocationId ? (
          <div className="row">
            <div className="flex items-center gap-1">
              <SearchBarOverflowMenu
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                applicableFields={applicableFields}
                visibility={visibility}
                onColumnToggle={toggleField}
                customFieldLabels={customFieldLabels}
              />
              <Tooltip content="Scan QR code" side="bottom">
                <Button
                  onClick={() => openScanDialog()}
                  size="icon"
                  variant="ghost"
                  className="hidden lg:inline-flex h-10 w-10 rounded-[var(--radius-sm)]"
                  aria-label="Scan QR code"
                >
                  <ScanLine className="h-5 w-5" />
                </Button>
              </Tooltip>
              {(aiEnabled || aiGated) && (
                <Tooltip content={`${/Mac|iPhone|iPad/.test(navigator.userAgent) ? '\u2318' : 'Ctrl+'}J`} side="bottom">
                  <Button
                    onClick={() => aiGated ? setUpgradeOpen(true) : getCommandInputRef().current?.open()}
                    variant="ghost"
                    size="sm"
                    className="hidden lg:inline-flex h-10 gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ai-accent)]/10 dark:bg-[var(--ai-accent)]/20 text-[var(--ai-accent)] hover:bg-[var(--ai-accent)]/15 dark:hover:bg-[var(--ai-accent)]/28 active:bg-[var(--ai-accent)]/20 dark:active:bg-[var(--ai-accent)]/35 dark:border dark:border-[var(--ai-accent)]/25 ai-shimmer"
                    aria-label="Ask AI"
                  >
                    <Sparkles className="h-4 w-4" />
                    Ask AI
                  </Button>
                </Tooltip>
              )}
            </div>
            {canCreateBin && (
              <Tooltip content={`New ${t.bin}`} side="bottom">
                <Button
                  onClick={() => setCreateOpen(true)}
                  size="icon"
                  className="h-10 w-10 rounded-[var(--radius-sm)]"
                  aria-label={`New ${t.bin}`}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </Tooltip>
            )}
          </div>
        ) : undefined}
      />

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
        <EmptyState
          icon={MapPin}
          title={`No ${t.location} selected`}
          subtitle={`Create or join a ${t.location} to start organizing ${t.bins}`}
          variant="onboard"
        >
          <Button onClick={() => navigate('/locations')} className="mt-1">
            <MapPin className="h-4 w-4 mr-2" />
            {`Manage ${t.Locations}`}
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* Bin views */}
          <Crossfade
            isLoading={isLoading && bins.length === 0}
            skeleton={<BinListSkeleton viewMode={viewMode} />}
          >
          {error ? (
              <EmptyState
                icon={AlertTriangle}
                title={`Failed to load ${t.bins}`}
                subtitle={error}
              />
          ) : bins.length === 0 ? (
            search || activeCount > 0 ? (
              <EmptyState
                icon={PackageOpen}
                title={`No ${t.bins} match your filters`}
                variant="search"
              />
            ) : (
              <EmptyState
                icon={PackageOpen}
                title={`No ${t.bins} yet`}
                subtitle={`Create your first ${t.bin} to get started`}
                variant="onboard"
              >
                {canCreateBin && (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-[12px] text-[var(--text-tertiary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[10px] font-bold text-[var(--accent)]">1</span>
                        Create {t.bin}
                      </span>
                      <span className="opacity-30">→</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[10px] font-bold text-[var(--accent)]">2</span>
                        Add items
                      </span>
                      <span className="opacity-30">→</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[10px] font-bold text-[var(--accent)]">3</span>
                        Print QR
                      </span>
                    </div>
                    <Button onClick={() => setCreateOpen(true)} className="mt-2">
                      <Plus className="h-4 w-4 mr-2" />
                      {`Create ${t.Bin}`}
                    </Button>
                  </>
                )}
              </EmptyState>
            )
          ) : viewMode === 'compact' ? (
            <div className={cn(selectable && "pb-16")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {bins.map((bin, index) => (
                  <div key={bin.id} className="animate-card-stagger" style={{ '--stagger-index': Math.min(index, 11) } as React.CSSProperties}>
                    <BinCompactCard
                      bin={bin}
                      index={index}
                      onTagClick={handleTagClick}
                      selectable={selectable}
                      selected={selectedIds.has(bin.id)}
                      onSelect={toggleSelect}
                      searchQuery={debouncedSearch}
                      sort={sort}
                      filters={filters}
                      isVisible={isVisible}
                    />
                  </div>
                ))}
              </div>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalCount={totalCount} pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={setPageSize} itemLabel={t.bins} />
            </div>
          ) : viewMode === 'table' ? (
            <div className={cn(selectable && "pb-16")}>
              <BinTableView
                bins={bins}
                sortColumn={sort}
                sortDirection={sortDir}
                onSortChange={handleBinSortChange}
                selectable={selectable}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
                searchQuery={debouncedSearch}
                filters={filters}
                onTagClick={handleTagClick}
                isVisible={isVisible}
                customFields={customFields}
              />
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalCount={totalCount} pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={setPageSize} itemLabel={t.bins} />
            </div>
          ) : (
            <div className={cn(selectable && "pb-16")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {bins.map((bin, index) => (
                  <div key={bin.id} className="animate-card-stagger" style={{ '--stagger-index': Math.min(index, 11) } as React.CSSProperties}>
                    <BinCard
                      bin={bin}
                      index={index}
                      onTagClick={handleTagClick}
                      selectable={selectable}
                      selected={selectedIds.has(bin.id)}
                      onSelect={toggleSelect}
                      searchQuery={debouncedSearch}
                      sort={sort}
                      filters={filters}
                      isVisible={isVisible}
                    />
                  </div>
                ))}
              </div>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalCount={totalCount} pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={setPageSize} itemLabel={t.bins} />
            </div>
          )}
          </Crossfade>
        </>
      )}

      <BinListDialogs
        createOpen={createOpen} setCreateOpen={setCreateOpen}
        createInitialPhotos={createInitialPhotos}
        onCreateInitialPhotosConsumed={onCreateInitialPhotosConsumed}
        filterOpen={filterOpen} setFilterOpen={setFilterOpen}
        saveViewOpen={saveViewOpen} setSaveViewOpen={setSaveViewOpen}
        allTags={allTags}
        areas={areas}
        filters={filters} setFilters={setFilters}
        sort={sort} setSort={setSort}
        sortDir={sortDir} setSortDir={setSortDir}
        search={search}
        bulk={bulk}
        selectedIds={selectedIds}
        clearSelection={clearSelection}
      />

      <DeleteBinDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        binName={`${selectedIds.size} ${selectedIds.size === 1 ? t.bin : t.bins}`}
        onConfirm={bulkDelete}
      />

      {selectable && canWrite && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          isBusy={isBusy}
          actions={buildBinBulkActions({
            isAdmin,
            pinLabel,
            aiEnabled,
            aiGated,
            canCopyStyle: selectedIds.size === 1,
            canPasteStyle: copiedStyle !== null,
            showPrint: true,
            showReorganize: true,
            onTag: () => bulk.open('tag'),
            onMove: () => bulk.open('area'),
            onDelete: () => setBulkDeleteOpen(true),
            onAppearance: () => bulk.open('appearance'),
            onVisibility: () => bulk.open('visibility'),
            onMoveLocation: () => bulk.open('location'),
            onPin: bulkPinToggle,
            onDuplicate: bulkDuplicate,
            onCustomFields: () => bulk.open('customFields'),
            onCopyStyle: handleCopyStyle,
            onPasteStyle: handlePasteStyle,
            onAskAi: () => (aiGated ? setUpgradeOpen(true) : getCommandInputRef().current?.open()),
            onReorganize: () => navigate(`/reorganize?ids=${[...selectedIds].join(',')}`),
            onPrint: () => navigate(`/print?ids=${[...selectedIds].join(',')}`),
          })}
        />
      )}

      {__EE__ && (
        <Suspense fallback={null}>
          <UpgradeDialog
            open={upgradeOpen}
            onOpenChange={setUpgradeOpen}
            feature="AI Features"
            description="AI-powered commands, analysis, and suggestions are available on the Pro plan."
          />
        </Suspense>
      )}
    </div>
  );
}
