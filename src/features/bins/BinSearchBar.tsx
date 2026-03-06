import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@chakra-ui/react';
import { DismissibleBadge } from '@/components/ui/dismissible-badge';
import { Tooltip } from '@/components/ui/tooltip';
import { HUE_RANGES } from '@/lib/colorPalette';
import type { Terminology } from '@/lib/terminology';
import type { Area } from '@/types';
import type { BinFilters } from './useBins';

interface BinSearchBarProps {
  search: string;
  setSearch: (v: string) => void;
  filters: BinFilters;
  setFilters: (v: BinFilters | ((prev: BinFilters) => BinFilters)) => void;
  clearAll: () => void;
  areas: Area[];
  getTagStyle: (tag: string) => CSSProperties | undefined;
  activeCount: number;
  hasBadges: boolean;
  onOpenFilter: () => void;
  t: Terminology;
  viewToggle?: React.ReactNode;
  columnPicker?: React.ReactNode;
  overflowMenu?: React.ReactNode;
}

export function BinSearchBar({
  search,
  setSearch,
  filters,
  setFilters,
  clearAll,
  areas,
  getTagStyle,
  activeCount,
  hasBadges,
  onOpenFilter,
  t,
  viewToggle,
  columnPicker,
  overflowMenu,
}: BinSearchBarProps) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Unified search bar with inline filter badges */}
      <div className="flex flex-1 min-w-0 items-center gap-1.5 rounded-[var(--radius-full)] bg-gray-500/12 dark:bg-gray-500/24 px-3.5 min-h-10 py-1.5 focus-within:ring-2 focus-within:ring-purple-600 dark:focus-within:ring-purple-500 focus-within:shadow-[0_0_0_4px_rgba(147,51,234,0.15)] dark:focus-within:shadow-[0_0_0_4px_rgba(168,85,247,0.2)] transition-all duration-200">
        <Search className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
        {hasBadges && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0 shrink">
            {filters.tags.map((tag) => (
              <DismissibleBadge
                key={`tag-${tag}`}
                onDismiss={() => setFilters({ ...filters, tags: filters.tags.filter((t2) => t2 !== tag) })}
                ariaLabel={`Remove tag filter ${tag}`}
                style={getTagStyle(tag)}
              >
                {tag}
              </DismissibleBadge>
            ))}
            {filters.tags.length >= 2 && (
              <Badge variant="outline" className="py-0.5 shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                {filters.tagMode === 'all' ? 'All tags' : 'Any tag'}
              </Badge>
            )}
            {filters.areas.map((areaKey) => {
              const areaName = areaKey === '__unassigned__' ? 'Unassigned' : areas.find((a) => a.id === areaKey)?.name ?? areaKey;
              return (
                <DismissibleBadge
                  key={`area-${areaKey}`}
                  onDismiss={() => setFilters({ ...filters, areas: filters.areas.filter((a) => a !== areaKey) })}
                  ariaLabel={`Remove area filter ${areaName}`}
                >
                  {areaName}
                </DismissibleBadge>
              );
            })}
            {filters.colors.map((rangeName) => {
              const range = HUE_RANGES.find((r) => r.name === rangeName);
              return (
                <DismissibleBadge
                  key={`color-${rangeName}`}
                  onDismiss={() => setFilters({ ...filters, colors: filters.colors.filter((c) => c !== rangeName) })}
                  ariaLabel={`Remove color filter ${range?.label ?? rangeName}`}
                  dot={range?.dot}
                >
                  {range?.label ?? rangeName}
                </DismissibleBadge>
              );
            })}
            {filters.hasItems && (
              <DismissibleBadge onDismiss={() => setFilters({ ...filters, hasItems: false })} ariaLabel="Remove has items filter">
                Has items
              </DismissibleBadge>
            )}
            {filters.hasNotes && (
              <DismissibleBadge onDismiss={() => setFilters({ ...filters, hasNotes: false })} ariaLabel="Remove has notes filter">
                Has notes
              </DismissibleBadge>
            )}
            {filters.needsOrganizing && (
              <DismissibleBadge onDismiss={() => setFilters({ ...filters, needsOrganizing: false })} ariaLabel="Remove needs organizing filter">
                Needs organizing
              </DismissibleBadge>
            )}
          </div>
        )}
        <input
          data-shortcut-search
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${t.bins}...`}
          className="flex-1 min-w-[80px] bg-transparent text-[15px]  placeholder:text-gray-500 dark:placeholder:text-gray-400 outline-none"
        />
        {(hasBadges || search) && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Clear all filters"
            className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-500/16 dark:hover:bg-gray-500/28 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-2.5">
        {viewToggle}
        {columnPicker}
      </div>
      {overflowMenu && <div className="sm:hidden">{overflowMenu}</div>}
      <Tooltip content="Filter" side="bottom">
        <Button
          variant="ghost"
          size="sm" px="0"
          onClick={onOpenFilter}
          flexShrink={0} className="relative"
          aria-label={`Filter ${t.bins}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-purple-600 dark:bg-purple-500 text-[10px] font-bold text-white flex items-center justify-center px-1">
              {activeCount}
            </span>
          )}
        </Button>
      </Tooltip>
    </div>
  );
}
