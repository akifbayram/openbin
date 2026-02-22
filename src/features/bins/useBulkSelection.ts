import { useState, useEffect, useCallback, useRef } from 'react';
import type { Bin } from '@/types';

export function useBulkSelection(bins: Bin[], resetDeps: unknown[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndex = useRef<number | null>(null);

  // Clear selection when filters/search/sort reset the list
  useEffect(() => {
    setSelectedIds(new Set());
    lastSelectedIndex.current = null;
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional variable deps from caller
  }, resetDeps);

  const selectable = selectedIds.size > 0;

  // Keyboard shortcuts: Escape to clear selection, Ctrl/Cmd+A to select all
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectable) {
        setSelectedIds(new Set());
        lastSelectedIndex.current = null;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && selectable) {
        e.preventDefault();
        setSelectedIds(new Set(bins.map((b) => b.id)));
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectable, bins]);

  const toggleSelect = useCallback((id: string, index: number, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIndex.current !== null) {
        const start = Math.min(lastSelectedIndex.current, index);
        const end = Math.max(lastSelectedIndex.current, index);
        for (let i = start; i <= end; i++) {
          if (bins[i]) next.add(bins[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    lastSelectedIndex.current = index;
  }, [bins]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIndex.current = null;
  }, []);

  return { selectedIds, selectable, toggleSelect, clearSelection };
}
