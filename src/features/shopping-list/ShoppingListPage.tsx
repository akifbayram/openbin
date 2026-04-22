import { Check, ShoppingCart, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { Highlight } from '@/components/ui/highlight';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useDebounce } from '@/lib/useDebounce';
import { usePermissions } from '@/lib/usePermissions';
import { useTableSearchParams } from '@/lib/useTableSearchParams';
import { cn } from '@/lib/utils';
import type { ShoppingListEntry } from '@/types';
import {
  addToShoppingList,
  markAsBought,
  removeFromShoppingList,
  useShoppingList,
} from './useShoppingList';

type ShoppingSortColumn = 'alpha' | 'bin';

function sortEntries(
  entries: ShoppingListEntry[],
  column: ShoppingSortColumn,
  direction: SortDirection,
): ShoppingListEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (column === 'bin') {
      const aKey = a.origin_bin_name ?? '￿';
      const bKey = b.origin_bin_name ?? '￿';
      const cmp = aKey.localeCompare(bKey);
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
  return direction === 'asc' ? sorted : sorted.reverse();
}

export function ShoppingListPage() {
  const { activeLocationId } = useAuth();
  const { canWrite } = usePermissions();
  const { showToast } = useToast();
  const locationId = activeLocationId ?? null;
  const { entries, isLoading } = useShoppingList(locationId);
  const { search, sortColumn, sortDirection, setSearch, setSort } =
    useTableSearchParams<ShoppingSortColumn>('alpha');
  const debouncedSearch = useDebounce(search, 300);
  const [newName, setNewName] = useState('');

  const visibleEntries = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = q
      ? entries.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.origin_bin_name ?? '').toLowerCase().includes(q),
        )
      : entries;
    return sortEntries(filtered, sortColumn, sortDirection);
  }, [entries, debouncedSearch, sortColumn, sortDirection]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name || !locationId) return;
    try {
      await addToShoppingList(locationId, name);
      setNewName('');
    } catch {
      showToast({ message: 'Failed to add', variant: 'error' });
    }
  }

  async function handleBought(entry: ShoppingListEntry) {
    try {
      const result = await markAsBought(entry.id);
      if (result.restored) {
        showToast({
          message: `Added back to ${entry.origin_bin_name ?? 'bin'}`,
          variant: 'success',
        });
      } else {
        showToast({ message: 'Marked bought' });
      }
    } catch {
      showToast({ message: 'Failed to mark bought', variant: 'error' });
    }
  }

  async function handleRemove(entry: ShoppingListEntry) {
    try {
      await removeFromShoppingList(entry.id);
    } catch {
      showToast({ message: 'Failed to remove', variant: 'error' });
    }
  }

  return (
    <div className="page-content-wide">
      <PageHeader
        title="Shopping List"
        actions={
          canWrite && locationId ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
                placeholder="Add an item…"
                className="max-w-xs"
              />
              <Button
                type="button"
                onClick={() => void handleAdd()}
                disabled={!newName.trim()}
              >
                Add
              </Button>
            </div>
          ) : undefined
        }
      />

      {(entries.length > 0 || search) && (
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={search ? () => setSearch('') : undefined}
          placeholder="Search items..."
        />
      )}

      <Crossfade
        isLoading={isLoading && entries.length === 0}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full rounded-[var(--radius-sm)]" />
            <div className="flat-card rounded-[var(--radius-md)] overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]">
                <Skeleton className="h-4 w-10 flex-[2]" />
                <Skeleton className="h-4 w-8 flex-1 hidden sm:block" />
                <Skeleton className="h-4 w-10 shrink-0" />
                <Skeleton className="h-4 w-10 shrink-0" />
              </div>
              <SkeletonList count={6} className="gap-0">
                {(i) => (
                  <div
                    className={cn(
                      'px-3 py-2.5 flex items-center gap-3',
                      i < 5 && 'border-b border-[var(--border-subtle)]',
                    )}
                  >
                    <Skeleton
                      className={cn(
                        'h-4 flex-[2]',
                        i % 3 === 0 ? 'w-2/3' : i % 3 === 1 ? 'w-1/2' : 'w-3/5',
                      )}
                    />
                    <div className="flex-1 min-w-0 items-center gap-2 hidden sm:flex">
                      <Skeleton className="h-5 w-5 rounded-[var(--radius-xs)] shrink-0" />
                      <Skeleton className={cn('h-4', i % 2 === 0 ? 'w-1/2' : 'w-2/5')} />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-[var(--radius-sm)] shrink-0" />
                    <Skeleton className="h-8 w-8 rounded-[var(--radius-sm)] shrink-0" />
                  </div>
                )}
              </SkeletonList>
            </div>
          </div>
        }
      >
        {visibleEntries.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={search ? 'No items match your search' : 'No items on your shopping list'}
            subtitle={
              search
                ? 'Try a different search term'
                : "When you remove an item from a bin, the undo toast offers an 'Add to list' shortcut. Items you add here also show up."
            }
            variant={search ? 'search' : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <SortHeader
                label="Item"
                column="alpha"
                currentColumn={sortColumn}
                currentDirection={sortDirection}
                onSort={setSort}
                className="flex-[2]"
              />
              <SortHeader
                label="Bin"
                column="bin"
                currentColumn={sortColumn}
                currentDirection={sortDirection}
                onSort={setSort}
                className="hidden sm:flex flex-1"
              />
              {canWrite && <span className="w-10 shrink-0" />}
              {canWrite && <span className="w-10 shrink-0" />}
            </TableHeader>

            {visibleEntries.map((entry) => {
              const BinIcon = resolveIcon(entry.origin_bin_icon ?? '');
              const colorPreset = entry.origin_bin_color
                ? resolveColor(entry.origin_bin_color)
                : undefined;
              return (
                <TableRow key={entry.id} className="cursor-default">
                  <div className="flex-[2] min-w-0">
                    <span className="truncate font-medium text-[14px] text-[var(--text-primary)] block">
                      <Highlight text={entry.name} query={debouncedSearch} />
                    </span>
                  </div>
                  <div
                    className={cn(
                      'hidden sm:flex flex-1 min-w-0 items-center gap-2',
                      entry.origin_bin_trashed && 'opacity-60',
                    )}
                  >
                    {entry.origin_bin_id ? (
                      <>
                        <BinIconBadge icon={BinIcon} colorPreset={colorPreset} />
                        <span className="truncate text-[13px] text-[var(--text-tertiary)]">
                          <Highlight
                            text={entry.origin_bin_name ?? ''}
                            query={debouncedSearch}
                          />
                        </span>
                      </>
                    ) : (
                      <span className="text-[13px] text-[var(--text-tertiary)]">
                        &mdash;
                      </span>
                    )}
                  </div>
                  {canWrite && (
                    <div className="w-10 shrink-0 flex justify-end">
                      <Tooltip content="Mark bought">
                        <button
                          type="button"
                          onClick={() => void handleBought(entry)}
                          aria-label={`Mark ${entry.name} bought`}
                          className="h-9 w-9 rounded-[var(--radius-lg)] flex items-center justify-center text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                  {canWrite && (
                    <div className="w-10 shrink-0 flex justify-end">
                      <Tooltip content="Remove">
                        <button
                          type="button"
                          onClick={() => void handleRemove(entry)}
                          aria-label={`Remove ${entry.name}`}
                          className="h-9 w-9 rounded-[var(--radius-lg)] flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </TableRow>
              );
            })}
          </Table>
        )}
      </Crossfade>
    </div>
  );
}
