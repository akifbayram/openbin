import { useCallback, useMemo, useState } from 'react';
import type { QueryMatch } from './useInventoryQuery';

export interface SelectedItem {
  itemId: string;
  binId: string;
  itemName: string;
}

export function useItemQuerySelection(matches: QueryMatch[]) {
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());

  const toggleItem = useCallback((itemId: string, binId: string, itemName: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.set(itemId, { itemId, binId, itemName });
      return next;
    });
  }, []);

  const selectAllInBin = useCallback((binId: string) => {
    const match = matches.find((m) => m.bin_id === binId);
    if (!match) return;
    setSelected((prev) => {
      const next = new Map(prev);
      for (const it of match.items) {
        next.set(it.id, { itemId: it.id, binId, itemName: it.name });
      }
      return next;
    });
  }, [matches]);

  const clearSelection = useCallback(() => setSelected(new Map()), []);

  const isSelected = useCallback((itemId: string) => selected.has(itemId), [selected]);

  const isBinFullySelected = useCallback((binId: string) => {
    const match = matches.find((m) => m.bin_id === binId);
    if (!match || match.items.length === 0) return false;
    return match.items.every((it) => selected.has(it.id));
  }, [matches, selected]);

  const isAnySelectedInBin = useCallback((binId: string) => {
    const match = matches.find((m) => m.bin_id === binId);
    if (!match) return false;
    return match.items.some((it) => selected.has(it.id));
  }, [matches, selected]);

  return useMemo(() => ({
    selected,
    selectionCount: selected.size,
    toggleItem,
    selectAllInBin,
    clearSelection,
    isSelected,
    isBinFullySelected,
    isAnySelectedInBin,
  }), [selected, toggleItem, selectAllInBin, clearSelection, isSelected, isBinFullySelected, isAnySelectedInBin]);
}
