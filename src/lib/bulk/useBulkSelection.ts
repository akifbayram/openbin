import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseBulkSelectionOptions<T> {
  items: T[];
  /** Default: (x: { id: string }) => x.id */
  getId?: (item: T) => string;
  /** Selection clears when any of these change. */
  resetDeps: unknown[];
}

export interface UseBulkSelectionOptionsWithGetId<T> extends UseBulkSelectionOptions<T> {
  getId: (item: T) => string;
}

export interface UseBulkSelectionResult {
  selectedIds: Set<string>;
  selectable: boolean;
  toggleSelect: (id: string, index: number, shiftKey: boolean) => void;
  clearSelection: () => void;
}

const defaultGetId = <T,>(x: T): string => (x as unknown as { id: string }).id;

// Overload 1: T has an `id: string` field — getId is optional
export function useBulkSelection<T extends { id: string }>(
  opts: UseBulkSelectionOptions<T>,
): UseBulkSelectionResult;
// Overload 2: T has no id field — getId is required
export function useBulkSelection<T>(
  opts: UseBulkSelectionOptionsWithGetId<T>,
): UseBulkSelectionResult;
export function useBulkSelection<T>(opts: UseBulkSelectionOptions<T>): UseBulkSelectionResult {
  const { items, getId = defaultGetId, resetDeps } = opts;

  // Hold latest items/getId in refs so the keydown listener stays stable
  // (otherwise it detaches/re-attaches on every render where items identity
  // changes, causing excessive listener churn in callers that don't memoize).
  const itemsRef = useRef(items);
  const getIdRef = useRef(getId);
  itemsRef.current = items;
  getIdRef.current = getId;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndex = useRef<number | null>(null);

  // Reset when caller-provided deps change (filters/search/sort/etc.)
  useEffect(() => {
    setSelectedIds(new Set());
    lastSelectedIndex.current = null;
    // biome-ignore lint/correctness/useExhaustiveDependencies: caller controls reset
  }, resetDeps);

  const selectable = selectedIds.size > 0;

  // Stable keydown listener — reads latest items/getId via refs.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
        return;
      }
      if (e.key === 'Escape') {
        setSelectedIds((prev) => {
          if (prev.size === 0) return prev;
          lastSelectedIndex.current = null;
          return new Set();
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && itemsRef.current.length > 0) {
        e.preventDefault();
        setSelectedIds(new Set(itemsRef.current.map(getIdRef.current)));
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSelect = useCallback((id: string, index: number, shiftKey: boolean) => {
    // Capture the anchor index BEFORE the setState updater is invoked, since
    // React may defer the updater until after we reassign lastSelectedIndex.
    const anchorIndex = lastSelectedIndex.current;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && anchorIndex !== null) {
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);
        for (let i = start; i <= end; i++) {
          if (items[i]) next.add(getId(items[i]));
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastSelectedIndex.current = index;
  }, [items, getId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIndex.current = null;
  }, []);

  return { selectedIds, selectable, toggleSelect, clearSelection };
}
