import { SlidersHorizontal } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DismissibleBadge } from '@/components/ui/dismissible-badge';
import { SearchInput } from '@/components/ui/search-input';
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
      <SearchInput
        data-shortcut-search
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${t.bins}...`}
        containerClassName="flex-1"
        onClear={(hasBadges || search) ? clearAll : undefined}
      >
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
              <Badge variant="outline" className="py-0.5 shrink-0 text-[11px] text-[var(--text-tertiary)]">
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
      </SearchInput>
      <div className="hidden sm:flex items-center gap-2.5">
        {viewToggle}
        {columnPicker}
      </div>
      {overflowMenu && <div className="sm:hidden">{overflowMenu}</div>}
      <Tooltip content="Filter" side="bottom">
        <Button
          variant="secondary"
          size="icon"
          onClick={onOpenFilter}
          className="shrink-0 relative"
          aria-label={`Filter ${t.bins}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-[var(--accent)] text-[10px] font-bold text-white flex items-center justify-center px-1">
              {activeCount}
            </span>
          )}
        </Button>
      </Tooltip>
    </div>
  );
}
