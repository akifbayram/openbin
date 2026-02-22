import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HUE_RANGES } from '@/lib/colorPalette';
import type { CSSProperties } from 'react';
import type { BinFilters } from './useBins';
import type { Area } from '@/types';
import type { Terminology } from '@/lib/terminology';

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
}: BinSearchBarProps) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Unified search bar with inline filter badges */}
      <div className="flex flex-1 min-w-0 items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--bg-input)] px-3.5 min-h-10 py-1.5 focus-within:ring-2 focus-within:ring-[var(--accent)] transition-all duration-200">
        <Search className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
        {hasBadges && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0 shrink">
            {filters.tags.map((tag) => (
              <Badge key={`tag-${tag}`} variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]" style={getTagStyle(tag)}>
                {tag}
                <button
                  onClick={() => setFilters({ ...filters, tags: filters.tags.filter((t2) => t2 !== tag) })}
                  aria-label={`Remove tag filter ${tag}`}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            {filters.tags.length >= 2 && (
              <Badge variant="outline" className="py-0.5 shrink-0 text-[11px] text-[var(--text-tertiary)]">
                {filters.tagMode === 'all' ? 'All tags' : 'Any tag'}
              </Badge>
            )}
            {filters.areas.map((areaKey) => {
              const areaName = areaKey === '__unassigned__' ? 'Unassigned' : areas.find((a) => a.id === areaKey)?.name ?? areaKey;
              return (
                <Badge key={`area-${areaKey}`} variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]">
                  {areaName}
                  <button
                    onClick={() => setFilters({ ...filters, areas: filters.areas.filter((a) => a !== areaKey) })}
                    aria-label={`Remove area filter ${areaName}`}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              );
            })}
            {filters.colors.map((rangeName) => {
              const range = HUE_RANGES.find((r) => r.name === rangeName);
              return (
                <Badge key={`color-${rangeName}`} variant="outline" className="gap-1.5 pr-1.5 py-0.5 shrink-0 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: range?.dot }} />
                  {range?.label ?? rangeName}
                  <button
                    onClick={() => setFilters({ ...filters, colors: filters.colors.filter((c) => c !== rangeName) })}
                    aria-label={`Remove color filter ${range?.label ?? rangeName}`}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              );
            })}
            {filters.hasItems && (
              <Badge variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]">
                Has items
                <button
                  onClick={() => setFilters({ ...filters, hasItems: false })}
                  aria-label="Remove has items filter"
                  className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {filters.hasNotes && (
              <Badge variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]">
                Has notes
                <button
                  onClick={() => setFilters({ ...filters, hasNotes: false })}
                  aria-label="Remove has notes filter"
                  className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {filters.needsOrganizing && (
              <Badge variant="outline" className="gap-1 pr-1.5 py-0.5 shrink-0 text-[11px]">
                Needs organizing
                <button
                  onClick={() => setFilters({ ...filters, needsOrganizing: false })}
                  aria-label="Remove needs organizing filter"
                  className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
          </div>
        )}
        <input
          data-shortcut-search
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${t.bins}...`}
          className="flex-1 min-w-[80px] bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
        />
        {(hasBadges || search) && (
          <button
            onClick={clearAll}
            aria-label="Clear all filters"
            className="p-1 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-active)] shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Button
        variant="secondary"
        size="icon"
        onClick={onOpenFilter}
        className="shrink-0 h-10 w-10 rounded-full relative"
        aria-label={`Filter ${t.bins}`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-[var(--accent)] text-[10px] font-bold text-white flex items-center justify-center px-1">
            {activeCount}
          </span>
        )}
      </Button>
    </div>
  );
}
