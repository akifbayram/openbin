import { useEffect, useMemo, useRef, useState } from 'react';

const COLLAPSED_COUNT = 10;
const FILTER_THRESHOLD = 15;

export function useCollapsibleList<T>(
  items: ReadonlyArray<T>,
  getSearchText: (item: T) => string,
) {
  const [expanded, setExpanded] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const itemCount = items.length;
  const prevCountRef = useRef(itemCount);
  useEffect(() => {
    if (itemCount > prevCountRef.current) setExpanded(true);
    prevCountRef.current = itemCount;
  }, [itemCount]);

  const showFilter = itemCount > FILTER_THRESHOLD;

  useEffect(() => {
    if (!showFilter) setFilterQuery('');
  }, [showFilter]);

  const getSearchTextRef = useRef(getSearchText);
  getSearchTextRef.current = getSearchText;

  const filteredIndices = useMemo(() => {
    if (!filterQuery) return items.map((_, i) => i);
    const lower = filterQuery.toLowerCase();
    const out: number[] = [];
    for (let i = 0; i < items.length; i++) {
      if (getSearchTextRef.current(items[i]).toLowerCase().includes(lower)) {
        out.push(i);
      }
    }
    return out;
  }, [items, filterQuery]);

  const isCollapsed = !expanded && !filterQuery && filteredIndices.length > COLLAPSED_COUNT;
  const visibleIndices = isCollapsed ? filteredIndices.slice(0, COLLAPSED_COUNT) : filteredIndices;
  const hiddenCount = isCollapsed ? filteredIndices.length - COLLAPSED_COUNT : 0;

  return {
    showFilter,
    filterQuery,
    setFilterQuery,
    filteredCount: filteredIndices.length,
    visibleIndices,
    hiddenCount,
    expand: () => setExpanded(true),
    collapse: () => setExpanded(false),
    canCollapse: expanded && !filterQuery && itemCount > COLLAPSED_COUNT,
  };
}
