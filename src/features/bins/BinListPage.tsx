import { useState, useCallback, useEffect } from 'react';
import {
  Search,
  Plus,
  PackageOpen,
  ArrowUpDown,
  SlidersHorizontal,
  Trash2,
  Tag,
  X,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
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
import { BinCard } from './BinCard';
import { BinCreateDialog } from './BinCreateDialog';
import { BinFilterDialog } from './BinFilterDialog';
import { BulkTagDialog } from './BulkTagDialog';
import { getColorPreset } from '@/lib/colorPalette';
import { useTagColorsContext } from '@/features/tags/TagColorsContext';
import { useTheme } from '@/lib/theme';
import type { Bin } from '@/types';

const sortLabels: Record<SortOption, string> = {
  updated: 'Recently Updated',
  created: 'Recently Created',
  name: 'Name',
};
const sortOrder: SortOption[] = ['updated', 'created', 'name'];

export function BinListPage() {
  const location = useLocation();
  const [search, setSearch] = useState(() => {
    const state = location.state as { search?: string } | null;
    return state?.search || '';
  });

  // Update search when navigating from Tags page
  useEffect(() => {
    const state = location.state as { search?: string } | null;
    if (state?.search) {
      setSearch(state.search);
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
  const { activeLocationId } = useAuth();
  const { bins, isLoading } = useBinList(debouncedSearch, sort, filters);
  const allTags = useAllTags();
  const activeCount = countActiveFilters(filters);
  const { tagColors } = useTagColorsContext();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const selectable = selectedIds.size > 0;

  const handleTagClick = useCallback((tag: string) => {
    setSearch(tag);
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
          <Button
            onClick={() => setCreateOpen(true)}
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Create bin"
          >
            <Plus className="h-5 w-5" />
          </Button>
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
      {(search || activeCount > 0) && (
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
          {(activeCount > 1 || (activeCount > 0 && search)) && (
            <button
              onClick={() => { setSearch(''); setFilters(EMPTY_FILTERS); }}
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
          <Button onClick={() => navigate('/locations')} variant="outline" className="rounded-[var(--radius-full)] mt-1">
            <MapPin className="h-4 w-4 mr-2" />
            Manage Locations
          </Button>
        </div>
      ) : /* Bin grid */
      isLoading ? (
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
            />
          ))}
        </div>
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
    </div>
  );
}
