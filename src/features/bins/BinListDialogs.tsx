import { lazy, Suspense } from 'react';
import type { Area } from '@/types';
import { BinCreateDialog } from './BinCreateDialog';
import { BinFilterDialog } from './BinFilterDialog';
import { BulkAppearanceDialog } from './BulkAppearanceDialog';
import { BulkAreaDialog } from './BulkAreaDialog';
import { BulkLocationDialog } from './BulkLocationDialog';
import { BulkTagDialog } from './BulkTagDialog';
import { BulkVisibilityDialog } from './BulkVisibilityDialog';
import { SaveViewDialog } from './SaveViewDialog';
import type { BinFilters, SortOption } from './useBins';
import type { BulkDialog } from './useBulkDialogs';

const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));

interface BinListDialogsProps {
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  filterOpen: boolean;
  setFilterOpen: (v: boolean) => void;
  saveViewOpen: boolean;
  setSaveViewOpen: (v: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  aiEnabled: boolean;
  allTags: string[];
  areas: Area[];
  filters: BinFilters;
  setFilters: (value: BinFilters | ((prev: BinFilters) => BinFilters)) => void;
  sort: SortOption;
  setSort: (s: SortOption) => void;
  search: string;
  bulk: { isOpen: (d: BulkDialog) => boolean; open: (d: BulkDialog) => void; close: () => void };
  selectedIds: Set<string>;
  clearSelection: () => void;
}

export function BinListDialogs({
  createOpen, setCreateOpen,
  filterOpen, setFilterOpen,
  saveViewOpen, setSaveViewOpen,
  commandOpen, setCommandOpen,
  aiEnabled, allTags, areas,
  filters, setFilters,
  sort, setSort, search,
  bulk, selectedIds, clearSelection,
}: BinListDialogsProps) {
  return (
    <>
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
    </>
  );
}
