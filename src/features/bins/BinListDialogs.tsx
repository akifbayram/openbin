import type { SortDirection } from '@/components/ui/sort-header';
import type { Area } from '@/types';
import { BinCreateDialog } from './BinCreateDialog';
import { BinFilterDialog } from './BinFilterDialog';
import { BulkAppearanceDialog } from './BulkAppearanceDialog';
import { BulkAreaDialog } from './BulkAreaDialog';
import { BulkCustomFieldsDialog } from './BulkCustomFieldsDialog';
import { BulkLocationDialog } from './BulkLocationDialog';
import { BulkTagDialog } from './BulkTagDialog';
import { BulkVisibilityDialog } from './BulkVisibilityDialog';
import { SaveViewDialog } from './SaveViewDialog';
import type { BinFilters, SortOption } from './useBins';
import type { BulkDialog } from './useBulkDialogs';

interface BinListDialogsProps {
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  createInitialPhotos: File[] | null;
  onCreateInitialPhotosConsumed: () => void;
  filterOpen: boolean;
  setFilterOpen: (v: boolean) => void;
  saveViewOpen: boolean;
  setSaveViewOpen: (v: boolean) => void;
  allTags: string[];
  areas: Area[];
  filters: BinFilters;
  setFilters: (value: BinFilters | ((prev: BinFilters) => BinFilters)) => void;
  sort: SortOption;
  setSort: (s: SortOption) => void;
  sortDir: SortDirection;
  setSortDir: (dir: SortDirection) => void;
  search: string;
  bulk: { isOpen: (d: BulkDialog) => boolean; open: (d: BulkDialog) => void; close: () => void };
  selectedIds: Set<string>;
  clearSelection: () => void;
}

export function BinListDialogs({
  createOpen, setCreateOpen,
  createInitialPhotos, onCreateInitialPhotosConsumed,
  filterOpen, setFilterOpen,
  saveViewOpen, setSaveViewOpen,
  allTags, areas,
  filters, setFilters,
  sort, setSort, sortDir, setSortDir, search,
  bulk, selectedIds, clearSelection,
}: BinListDialogsProps) {
  return (
    <>
      <BinCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialPhotos={createInitialPhotos}
        onInitialPhotosConsumed={onCreateInitialPhotosConsumed}
        allTags={allTags}
      />
      <BinFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onFiltersChange={setFilters}
        availableTags={allTags}
        areas={areas}
        sort={sort}
        onSortChange={setSort}
        sortDir={sortDir}
        onSortDirChange={setSortDir}
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
      <BulkCustomFieldsDialog
        open={bulk.isOpen('customFields')}
        onOpenChange={(v) => v ? bulk.open('customFields') : bulk.close()}
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
    </>
  );
}
