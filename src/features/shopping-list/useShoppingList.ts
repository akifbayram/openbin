import { apiFetch } from '@/lib/api';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListQuery';
import type { ShoppingListEntry } from '@/types';

export function useShoppingList(locationId: string | null) {
  const { data, isLoading } = useListData<ShoppingListEntry>(
    locationId ? `/api/locations/${locationId}/shopping-list` : null,
    [Events.SHOPPING_LIST],
  );
  return { entries: data, isLoading };
}

export async function addItemsToShoppingList(
  binId: string,
  names: string[],
): Promise<ShoppingListEntry[]> {
  const result = await apiFetch<{ entries: ShoppingListEntry[]; count: number }>(
    `/api/bins/${binId}/shopping-list`,
    { method: 'POST', body: { names } },
  );
  notify(Events.SHOPPING_LIST);
  return result.entries;
}

export async function addToShoppingList(
  locationId: string,
  name: string,
  originBinId?: string | null,
): Promise<ShoppingListEntry> {
  const body: { name: string; originBinId?: string | null } = { name };
  if (originBinId) body.originBinId = originBinId;
  const result = await apiFetch<{ entry: ShoppingListEntry }>(
    `/api/locations/${locationId}/shopping-list`,
    { method: 'POST', body },
  );
  notify(Events.SHOPPING_LIST);
  return result.entry;
}

export async function markAsBought(id: string): Promise<{
  deleted: true;
  restored: { binId: string; itemId: string; name: string } | null;
}> {
  const result = await apiFetch<{
    deleted: true;
    restored: { binId: string; itemId: string; name: string } | null;
  }>(`/api/shopping-list/${id}/purchase`, { method: 'POST' });
  notify(Events.SHOPPING_LIST);
  if (result.restored) notify(Events.BINS);
  return result;
}

export async function removeFromShoppingList(id: string): Promise<void> {
  await apiFetch(`/api/shopping-list/${id}`, { method: 'DELETE' });
  notify(Events.SHOPPING_LIST);
}

export function notifyShoppingListChanged() {
  notify(Events.SHOPPING_LIST);
}
