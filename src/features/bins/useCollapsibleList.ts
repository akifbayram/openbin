import { useEffect, useRef, useState } from 'react';

const COLLAPSED_COUNT = 10;
const FILTER_THRESHOLD = 15;

export function useCollapsibleList(
  itemCount: number,
  getSearchText: (index: number) => string,
) {
  const [expanded, setExpanded] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Auto-expand when items are added
  const prevCountRef = useRef(itemCount);
  useEffect(() => {
    if (itemCount > prevCountRef.current) setExpanded(true);
    prevCountRef.current = itemCount;
  }, [itemCount]);

  const showFilter = itemCount > FILTER_THRESHOLD;

  // Clear stale filter when item count drops below threshold
  useEffect(() => {
    if (!showFilter) setFilterQuery('');
  }, [showFilter]);

  const lowerFilter = filterQuery.toLowerCase();

  const filteredIndices: number[] = [];
  for (let i = 0; i < itemCount; i++) {
    if (!filterQuery || getSearchText(i).toLowerCase().includes(lowerFilter)) {
      filteredIndices.push(i);
    }
  }

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
