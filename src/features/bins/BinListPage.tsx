import { useState, useCallback } from 'react';
import {
  Search,
  Plus,
  PackageOpen,
  ArrowUpDown,
  Trash2,
  Tag,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { haptic } from '@/lib/utils';
import { useDebounce } from '@/lib/useDebounce';
import { useBinList, deleteBin, restoreBin, type SortOption } from './useBins';
import { getPhotosForBin } from '@/features/photos/usePhotos';
import { BinCard } from './BinCard';
import { BinCreateDialog } from './BinCreateDialog';
import { BulkTagDialog } from './BulkTagDialog';
import type { Bin, Photo } from '@/types';

const sortLabels: Record<SortOption, string> = {
  updated: 'Recently Updated',
  created: 'Recently Created',
  name: 'Name',
};
const sortOrder: SortOption[] = ['updated', 'created', 'name'];

export function BinListPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [sort, setSort] = useState<SortOption>('updated');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  // Filtering is handled inside useBinList's Dexie live query — no extra memoization needed
  const bins = useBinList(debouncedSearch, sort);
  const { showToast } = useToast();

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
    if (!bins) return;
    const toDelete = bins.filter((b) => selectedIds.has(b.id));
    const snapshot: Bin[] = toDelete.map((b) => ({ ...b }));
    const photoSnapshots: Map<string, Photo[]> = new Map();
    await Promise.all(
      toDelete.map(async (b) => {
        photoSnapshots.set(b.id, await getPhotosForBin(b.id));
      })
    );
    await Promise.all(toDelete.map((b) => deleteBin(b.id)));
    haptic([50, 30, 50]);
    clearSelection();
    showToast({
      message: `Deleted ${snapshot.length} bin${snapshot.length !== 1 ? 's' : ''}`,
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const bin of snapshot) {
            await restoreBin(bin, photoSnapshots.get(bin.id));
          }
        },
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 px-[var(--page-px)] pt-6 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Bins
        </h1>
        <Button
          onClick={() => setCreateOpen(true)}
          size="icon"
          className="h-10 w-10 rounded-full"
          aria-label="Create bin"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Search + Sort */}
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
          size="sm"
          onClick={cycleSort}
          className="shrink-0 rounded-[var(--radius-full)] gap-1.5 h-10 px-3.5"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="text-[13px]">{sortLabels[sort]}</span>
        </Button>
      </div>

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

      {/* Active filter indicator */}
      {search && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 pr-1.5 py-1">
            "{search}"
            <button onClick={() => setSearch('')} aria-label="Clear search" className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        </div>
      )}

      {/* Bin grid */}
      {bins === undefined ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              {search ? 'No bins match your search' : 'No bins yet'}
            </p>
            {!search && (
              <p className="text-[13px]">Create your first bin to get started</p>
            )}
          </div>
          {!search && (
            <Button onClick={() => setCreateOpen(true)} variant="outline" className="rounded-[var(--radius-full)] mt-1">
              <Plus className="h-4 w-4 mr-2" />
              Create Bin
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      <BulkTagDialog
        open={bulkTagOpen}
        onOpenChange={setBulkTagOpen}
        binIds={[...selectedIds]}
        onDone={clearSelection}
      />
    </div>
  );
}
