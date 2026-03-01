import {
  MapPin,
  PackageOpen,
  Plus,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import type { SortDirection } from '@/components/ui/sort-header';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useAreaList } from '@/features/areas/useAreas';
import { useScanDialog } from '@/features/qrcode/ScanDialogContext';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import { cn } from '@/lib/utils';
import { BinCard } from './BinCard';
import { BinCompactCard } from './BinCompactCard';
import { BinListDialogs } from './BinListDialogs';
import { BinListSkeleton } from './BinListSkeleton';
import { BinSearchBar } from './BinSearchBar';
import { BinTableView } from './BinTableView';
import { BulkActionBar } from './BulkActionBar';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { SearchBarOverflowMenu } from './SearchBarOverflowMenu';
import { useBinSearchParams } from './useBinSearchParams';
import { countActiveFilters, type SortOption, updateBin, useAllTags, usePaginatedBinList } from './useBins';
import { useBulkActions } from './useBulkActions';
import { useBulkDialogs } from './useBulkDialogs';
import { useBulkSelection } from './useBulkSelection';
import { useColumnVisibility } from './useColumnVisibility';
import { usePageSize } from './usePageSize';
import { useViewMode } from './useViewMode';
import { ViewModeToggle } from './ViewModeToggle';

export function BinListPage() {
  const t = useTerminology();
  const location = useLocation();
  const { search, setSearch, debouncedSearch, sort, setSort, sortDir, setSortDir, filters, setFilters, page, setPage, clearAll } = useBinSearchParams();

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
  const resetPage = useCallback(() => setPage(1), [setPage]);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize(resetPage);
  const { bins, totalCount, totalPages, isLoading } = usePaginatedBinList(debouncedSearch, sort, sortDir, filters, page, pageSize, setPage);
  const allTags = useAllTags();
  const activeCount = countActiveFilters(filters);
  const { areas } = useAreaList(activeLocationId);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { openScanDialog } = useScanDialog();
  const { aiEnabled } = useAiEnabled();
  const [commandOpen, setCommandOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const getTagStyle = useTagStyle();
  const { viewMode, setViewMode } = useViewMode();
  const { visibility, toggleField, applicableFields, isVisible } = useColumnVisibility(viewMode);
  const hasBadges = activeCount > 0 || !!filters.needsOrganizing;

  const bulk = useBulkDialogs();
  const { selectedIds, selectable, toggleSelect, clearSelection } = useBulkSelection(bins, [debouncedSearch, sort, sortDir, filters]);
  const { bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel } = useBulkActions(bins, selectedIds, clearSelection, showToast, t);

  const [copiedStyle, setCopiedStyle] = useState<{ icon: string; color: string; card_style: string } | null>(null);

  const handleCopyStyle = useCallback(() => {
    const [id] = selectedIds;
    const bin = bins.find((b) => b.id === id);
    if (!bin) return;
    setCopiedStyle({ icon: bin.icon, color: bin.color, card_style: bin.card_style });
    clearSelection();
    showToast({ message: 'Style copied' });
  }, [selectedIds, bins, clearSelection, showToast]);

  const handlePasteStyle = useCallback(async () => {
    if (!copiedStyle) return;
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => updateBin(id, { icon: copiedStyle.icon, color: copiedStyle.color, cardStyle: copiedStyle.card_style })));
    clearSelection();
    showToast({ message: `Style applied to ${ids.length} ${ids.length === 1 ? t.bin : t.bins}` });
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
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Tooltip content="Scan QR code" side="bottom">
                <Button
                  onClick={() => openScanDialog()}
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full"
                  aria-label="Scan QR code"
                >
                  <ScanLine className="h-5 w-5" />
                </Button>
              </Tooltip>
              {aiEnabled && (
                <Tooltip content="Ask AI" side="bottom">
                  <Button
                    onClick={() => setCommandOpen(true)}
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full"
                    aria-label="Ask AI"
                  >
                    <Sparkles className="h-5 w-5" />
                  </Button>
                </Tooltip>
              )}
            </div>
            <Tooltip content={`New ${t.bin}`} side="bottom">
              <Button
                onClick={() => setCreateOpen(true)}
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label={`New ${t.bin}`}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </Tooltip>
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
          viewToggle={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
          columnPicker={<ColumnVisibilityMenu applicableFields={applicableFields} visibility={visibility} onToggle={toggleField} />}
          overflowMenu={
            <SearchBarOverflowMenu
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              applicableFields={applicableFields}
              visibility={visibility}
              onColumnToggle={toggleField}
            />
          }
        />
      )}

      {/* No location selected prompt */}
      {!activeLocationId ? (
        <EmptyState
          icon={MapPin}
          title={`No ${t.location} selected`}
          subtitle={`Create or join a ${t.location} to start organizing ${t.bins}`}
        >
          <Button onClick={() => navigate('/locations')} variant="outline" className="rounded-[var(--radius-full)] mt-1">
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
          {bins.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title={search || activeCount > 0 ? `No ${t.bins} match your filters` : `No ${t.bins} yet`}
              subtitle={!search && activeCount === 0 ? `Create your first ${t.bin} to get started` : undefined}
            >
              {!search && activeCount === 0 && (
                <Button onClick={() => setCreateOpen(true)} variant="outline" className="rounded-[var(--radius-full)] mt-1">
                  <Plus className="h-4 w-4 mr-2" />
                  {`Create ${t.Bin}`}
                </Button>
              )}
            </EmptyState>
          ) : viewMode === 'compact' ? (
            <div className={cn(selectable && "pb-16")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {bins.map((bin, index) => (
                  <BinCompactCard
                    key={bin.id}
                    bin={bin}
                    index={index}
                    onTagClick={handleTagClick}
                    selectable={selectable}
                    selected={selectedIds.has(bin.id)}
                    onSelect={toggleSelect}
                    searchQuery={debouncedSearch}
                    isVisible={isVisible}
                  />
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
                onTagClick={handleTagClick}
                isVisible={isVisible}
              />
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalCount={totalCount} pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={setPageSize} itemLabel={t.bins} />
            </div>
          ) : (
            <div className={cn(selectable && "pb-16")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    isVisible={isVisible}
                  />
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
        filterOpen={filterOpen} setFilterOpen={setFilterOpen}
        saveViewOpen={saveViewOpen} setSaveViewOpen={setSaveViewOpen}
        commandOpen={commandOpen} setCommandOpen={setCommandOpen}
        aiEnabled={aiEnabled}
        allTags={allTags}
        areas={areas}
        filters={filters} setFilters={setFilters}
        sort={sort} setSort={setSort}
        search={search}
        bulk={bulk}
        selectedIds={selectedIds}
        clearSelection={clearSelection}
      />

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
          onCopyStyle={handleCopyStyle}
          onPasteStyle={handlePasteStyle}
          canCopyStyle={selectedIds.size === 1}
          canPasteStyle={copiedStyle !== null}
        />
      )}
    </div>
  );
}
