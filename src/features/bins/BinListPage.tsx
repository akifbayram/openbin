import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Search,
  Plus,
  PackageOpen,
  Pin,
  ArrowUpDown,
  SlidersHorizontal,
  Trash2,
  Tag,
  X,
  CheckCircle2,
  MapPin,
  Bookmark,
  ImagePlus,
  MessageSquare,
} from 'lucide-react';

const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { haptic } from '@/lib/utils';
import { useDebounce } from '@/lib/useDebounce';
import { useAuth } from '@/lib/auth';
import { useBinList, useAllTags, deleteBin, restoreBin, countActiveFilters, EMPTY_FILTERS, type SortOption, type BinFilters } from './useBins';
import { usePinnedBins, pinBin, unpinBin } from '@/features/pins/usePins';
import { BinCard } from './BinCard';
import { BinCreateDialog } from './BinCreateDialog';
import { BinFilterDialog } from './BinFilterDialog';
import { BulkTagDialog } from './BulkTagDialog';
import { BulkAreaDialog } from './BulkAreaDialog';
import { getColorPreset } from '@/lib/colorPalette';
import { useTagColorsContext } from '@/features/tags/TagColorsContext';
import { useAreaList } from '@/features/areas/useAreas';
import { useTheme } from '@/lib/theme';
import { useAiEnabled } from '@/lib/aiToggle';
import { getSavedViews, saveView, deleteView, type SavedView } from '@/lib/savedViews';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Bin } from '@/types';

const sortLabels: Record<SortOption, string> = {
  updated: 'Recently Updated',
  created: 'Recently Created',
  name: 'Name',
  area: 'Area',
};
const sortOrder: SortOption[] = ['updated', 'created', 'name', 'area'];

export function BinListPage() {
  const location = useLocation();
  const [search, setSearch] = useState(() => {
    const state = location.state as { search?: string } | null;
    return state?.search || '';
  });

  // Update search/filters when navigating from Tags/Areas/Dashboard pages
  useEffect(() => {
    const state = location.state as { search?: string; areaFilter?: string; needsOrganizing?: boolean } | null;
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
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const { activeLocationId, user } = useAuth();
  const { bins, isLoading } = useBinList(debouncedSearch, sort, filters);
  const { pinnedBins } = usePinnedBins();
  const allTags = useAllTags();
  const activeCount = countActiveFilters(filters);
  const { tagColors } = useTagColorsContext();
  const { areas } = useAreaList(activeLocationId);
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { aiEnabled } = useAiEnabled();
  const [commandOpen, setCommandOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close add menu on click outside
  useEffect(() => {
    if (!addMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [addMenuOpen]);

  // Load saved views
  useEffect(() => {
    if (user?.id) {
      setSavedViews(getSavedViews(user.id));
    }
  }, [user?.id]);

  const hasActiveFiltersOrSearch = search.trim() !== '' || countActiveFilters(filters) > 0;

  function handleSaveView() {
    if (!user?.id || !viewName.trim()) return;
    saveView(user.id, {
      name: viewName.trim(),
      searchQuery: search,
      sort,
      filters,
    });
    setSavedViews(getSavedViews(user.id));
    setViewName('');
    setSaveViewOpen(false);
  }

  function handleDeleteView(viewId: string) {
    if (!user?.id) return;
    deleteView(user.id, viewId);
    setSavedViews(getSavedViews(user.id));
  }

  function applyView(view: SavedView) {
    setSearch(view.searchQuery);
    setSort(view.sort);
    setFilters(view.filters);
  }

  const selectable = selectedIds.size > 0;

  const handleTagClick = useCallback((tag: string) => {
    setSearch(tag);
  }, []);

  const handlePinToggle = useCallback(async (id: string, pinned: boolean) => {
    if (pinned) await pinBin(id);
    else await unpinBin(id);
  }, []);

  function cycleSort() {
    setSort((prev) => {
      const idx = sortOrder.indexOf(prev);
      return sortOrder[(idx + 1) % sortOrder.length];
    });
  }

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
    <div className="flex flex-col gap-4 px-5 pt-6 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Bins
        </h1>
        {activeLocationId && (
          <div ref={addMenuRef} className="relative">
            <Button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Add bin"
            >
              <Plus className="h-5 w-5" />
            </Button>
            {addMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-lg overflow-hidden z-20">
                <button
                  onClick={() => { setAddMenuOpen(false); setCreateOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Plus className="h-4 w-4 text-[var(--text-secondary)]" />
                  New Bin
                </button>
                {aiEnabled && (
                  <button
                    onClick={() => { setAddMenuOpen(false); navigate('/bulk-add'); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <ImagePlus className="h-4 w-4 text-[var(--text-secondary)]" />
                    Add from Photos
                  </button>
                )}
                {aiEnabled && (
                  <button
                    onClick={() => { setAddMenuOpen(false); setCommandOpen(true); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <MessageSquare className="h-4 w-4 text-[var(--text-secondary)]" />
                    Ask AI
                  </button>
                )}
              </div>
            )}
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
          <Button
            variant="secondary"
            size="sm"
            onClick={cycleSort}
            className="shrink-0 rounded-[var(--radius-full)] gap-1.5 h-10 px-3.5"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="text-[13px] truncate">{sortLabels[sort]}</span>
          </Button>
          {hasActiveFiltersOrSearch && (
            <Button
              variant="secondary"
              size="icon"
              onClick={() => { setViewName(''); setSaveViewOpen(true); }}
              className="shrink-0 h-10 w-10 rounded-full"
              aria-label="Save current view"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Saved view chips */}
      {savedViews.length > 0 && activeLocationId && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {savedViews.map((view) => (
            <button
              key={view.id}
              onClick={() => applyView(view)}
              className="shrink-0 flex items-center gap-1.5 rounded-[var(--radius-full)] px-3 py-1.5 text-[13px] font-medium glass-card hover:ring-1 hover:ring-[var(--accent)] transition-all"
            >
              <Bookmark className="h-3 w-3 text-[var(--accent)]" />
              {view.name}
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
                className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                aria-label={`Remove saved view ${view.name}`}
              >
                <X className="h-3 w-3 text-[var(--text-tertiary)]" />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && (
        <div className="glass-card rounded-[var(--radius-full)] flex items-center gap-2 px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-[13px] font-medium text-[var(--text-secondary)] flex-1">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 rounded-[var(--radius-full)]"
            onClick={() => setBulkTagOpen(true)}
          >
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            Tag
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 rounded-[var(--radius-full)]"
            onClick={() => setBulkAreaOpen(true)}
          >
            <MapPin className="h-3.5 w-3.5 mr-1.5" />
            Move
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 rounded-[var(--radius-full)] text-[var(--destructive)]"
            onClick={bulkDelete}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Active filter indicators */}
      {(search || activeCount > 0 || filters.needsOrganizing) && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {search && (
            <Badge variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
              &quot;{search}&quot;
              <button onClick={() => setSearch('')} aria-label="Clear search" className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {filters.tags.map((tag) => {
            const colorKey = tagColors.get(tag);
            const preset = colorKey ? getColorPreset(colorKey) : undefined;
            const style: React.CSSProperties | undefined = preset
              ? {
                  backgroundColor: theme === 'dark' ? preset.bgDark : preset.bg,
                  color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)',
                }
              : undefined;
            return (
              <Badge key={`tag-${tag}`} variant="outline" className="gap-1 pr-1.5 py-1 shrink-0" style={style}>
                {tag}
                <button
                  onClick={() => setFilters((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}
                  aria-label={`Remove tag filter ${tag}`}
                  className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
          {filters.tags.length >= 2 && (
            <Badge variant="outline" className="py-1 shrink-0 text-[var(--text-tertiary)]">
              {filters.tagMode === 'all' ? 'All tags' : 'Any tag'}
            </Badge>
          )}
          {filters.areas.map((areaKey) => {
            const areaName = areaKey === '__unassigned__' ? 'Unassigned' : areas.find((a) => a.id === areaKey)?.name ?? areaKey;
            return (
              <Badge key={`area-${areaKey}`} variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
                {areaName}
                <button
                  onClick={() => setFilters((f) => ({ ...f, areas: f.areas.filter((a) => a !== areaKey) }))}
                  aria-label={`Remove area filter ${areaName}`}
                  className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
          {filters.colors.map((key) => {
            const preset = getColorPreset(key);
            return (
              <Badge key={`color-${key}`} variant="outline" className="gap-1.5 pr-1.5 py-1 shrink-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: preset?.dot }} />
                {preset?.label ?? key}
                <button
                  onClick={() => setFilters((f) => ({ ...f, colors: f.colors.filter((c) => c !== key) }))}
                  aria-label={`Remove color filter ${preset?.label ?? key}`}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
          {filters.hasItems && (
            <Badge variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
              Has items
              <button
                onClick={() => setFilters((f) => ({ ...f, hasItems: false }))}
                aria-label="Remove has items filter"
                className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {filters.hasNotes && (
            <Badge variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
              Has notes
              <button
                onClick={() => setFilters((f) => ({ ...f, hasNotes: false }))}
                aria-label="Remove has notes filter"
                className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {filters.needsOrganizing && (
            <Badge variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
              Needs organizing
              <button
                onClick={() => setFilters((f) => ({ ...f, needsOrganizing: false }))}
                aria-label="Remove needs organizing filter"
                className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {(activeCount > 1 || (activeCount > 0 && search) || filters.needsOrganizing) && (
            <button
              onClick={() => { setSearch(''); setFilters({ ...EMPTY_FILTERS, needsOrganizing: false }); }}
              className="text-[12px] text-[var(--accent)] font-medium shrink-0 ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

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
          {/* Pinned bins row */}
          {pinnedBins.length > 0 && !selectable && (
            <div className="flex flex-col gap-2">
              <h2 className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Pinned</h2>
              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
                {pinnedBins.map((pin) => (
                  <button
                    key={pin.id}
                    onClick={() => navigate(`/bin/${pin.id}`)}
                    className="shrink-0 glass-card rounded-[var(--radius-lg)] px-3.5 py-2.5 flex items-center gap-2.5 max-w-[200px] active:scale-[0.98] transition-all"
                  >
                    <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="currentColor" />
                    <div className="min-w-0 text-left">
                      <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">{pin.name}</p>
                      {pin.items.length > 0 && (
                        <p className="text-[12px] text-[var(--text-tertiary)]">{pin.items.length} item{pin.items.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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

      {/* Save View Dialog */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <Input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="View name..."
            className="rounded-[var(--radius-full)] h-10 text-[15px]"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveView(); }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveViewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveView} disabled={!viewName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {aiEnabled && (
        <Suspense fallback={null}>
          {commandOpen && <CommandInput open={commandOpen} onOpenChange={setCommandOpen} />}
        </Suspense>
      )}
    </div>
  );
}
