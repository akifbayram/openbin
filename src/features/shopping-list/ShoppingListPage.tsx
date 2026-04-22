import { Check, ShoppingCart, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/usePermissions';
import { cn } from '@/lib/utils';
import type { ShoppingListEntry } from '@/types';
import {
  addToShoppingList,
  markAsBought,
  removeFromShoppingList,
  useShoppingList,
} from './useShoppingList';

type Group = {
  key: string;
  binName: string | null;
  binIcon: string | null;
  binColor: string | null;
  trashed: boolean;
  entries: ShoppingListEntry[];
};

function groupByBin(entries: ShoppingListEntry[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    const key = e.origin_bin_id ?? '__no_origin__';
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        binName: e.origin_bin_name,
        binIcon: e.origin_bin_icon,
        binColor: e.origin_bin_color,
        trashed: e.origin_bin_trashed,
        entries: [],
      };
      map.set(key, group);
    }
    group.entries.push(e);
  }
  const list = Array.from(map.values());
  list.sort((a, b) => {
    if (a.key === '__no_origin__') return 1;
    if (b.key === '__no_origin__') return -1;
    return (a.binName ?? '').localeCompare(b.binName ?? '');
  });
  return list;
}

export function ShoppingListPage() {
  const { activeLocationId } = useAuth();
  const { canWrite } = usePermissions();
  const { showToast } = useToast();
  const locationId = activeLocationId ?? null;
  const { entries, isLoading } = useShoppingList(locationId);
  const [newName, setNewName] = useState('');

  const groups = useMemo(() => groupByBin(entries), [entries]);

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

  const countLabel = entries.length > 0
    ? `${entries.length} item${entries.length === 1 ? '' : 's'}`
    : undefined;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8">
      <PageHeader
        title={countLabel ? `Shopping List — ${countLabel}` : 'Shopping List'}
        actions={
          canWrite && locationId ? (
            <div className="flex gap-2">
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
                className="w-48 sm:w-64"
              />
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={!newName.trim()}
                className="px-4 py-2 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white font-medium disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <SkeletonList count={3}>
          {() => <Skeleton className="h-12 w-full rounded-[var(--radius-md)]" />}
        </SkeletonList>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No items on your shopping list"
          subtitle="When you remove an item from a bin, the undo toast offers an 'Add to list' shortcut. Items you add here also show up."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {group.key === '__no_origin__' ? (
                  <span className="ui-eyebrow text-[var(--text-tertiary)]">No origin</span>
                ) : (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-md)] text-[13px] font-medium',
                      group.trashed && 'opacity-60',
                    )}
                    style={{ backgroundColor: group.binColor ?? 'transparent' }}
                  >
                    {group.binIcon && <span aria-hidden>{group.binIcon}</span>}
                    <span>{group.binName ?? 'Bin'}</span>
                    {group.trashed && <span className="text-[11px]">(trashed)</span>}
                  </span>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-[var(--border-flat)] rounded-[var(--radius-xl)] flat-card overflow-hidden">
                {group.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex-1 text-[15px]">{entry.name}</span>
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleBought(entry)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-lg)] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[13px] font-semibold"
                        >
                          <Check className="h-4 w-4" />
                          Bought
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemove(entry)}
                          aria-label="Remove"
                          className="p-2 rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
