import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getColorPreset } from '@/lib/colorPalette';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { EMPTY_FILTERS, type BinFilters } from './useBins';
import type { Area } from '@/types';

interface FilterBadgesBarProps {
  search: string;
  onSearchClear: () => void;
  filters: BinFilters;
  onFiltersChange: (f: BinFilters) => void;
  activeCount: number;
  areas: Area[];
}

export function FilterBadgesBar({
  search,
  onSearchClear,
  filters,
  onFiltersChange,
  activeCount,
  areas,
}: FilterBadgesBarProps) {
  const getTagStyle = useTagStyle();

  if (!search && activeCount === 0 && !filters.needsOrganizing) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
      {search && (
        <Badge variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
          &quot;{search}&quot;
          <button onClick={onSearchClear} aria-label="Clear search" className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]">
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      )}
      {filters.tags.map((tag) => {
        return (
          <Badge key={`tag-${tag}`} variant="outline" className="gap-1 pr-1.5 py-1 shrink-0" style={getTagStyle(tag)}>
            {tag}
            <button
              onClick={() => onFiltersChange({ ...filters, tags: filters.tags.filter((t) => t !== tag) })}
              aria-label={`Remove tag filter ${tag}`}
              className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        );
      })}
      {filters.tags.length >= 2 && (
        <Badge variant="outline" className="py-1 shrink-0 text-[var(--text-tertiary)]">
          {filters.tagMode === 'all' ? 'All tags' : 'Any tag'}
        </Badge>
      )}
      {filters.areas.map((areaKey) => {
        const areaName = areaKey === '__unassigned__' ? 'Unassigned' : areas.find((a) => a.id === areaKey)?.name ?? areaKey;
        return (
          <Badge key={`area-${areaKey}`} variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
            {areaName}
            <button
              onClick={() => onFiltersChange({ ...filters, areas: filters.areas.filter((a) => a !== areaKey) })}
              aria-label={`Remove area filter ${areaName}`}
              className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        );
      })}
      {filters.colors.map((key) => {
        const preset = getColorPreset(key);
        return (
          <Badge key={`color-${key}`} variant="outline" className="gap-1.5 pr-1.5 py-1 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: preset?.dot }} />
            {preset?.label ?? key}
            <button
              onClick={() => onFiltersChange({ ...filters, colors: filters.colors.filter((c) => c !== key) })}
              aria-label={`Remove color filter ${preset?.label ?? key}`}
              className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        );
      })}
      {filters.hasItems && (
        <Badge variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
          Has items
          <button
            onClick={() => onFiltersChange({ ...filters, hasItems: false })}
            aria-label="Remove has items filter"
            className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      )}
      {filters.hasNotes && (
        <Badge variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
          Has notes
          <button
            onClick={() => onFiltersChange({ ...filters, hasNotes: false })}
            aria-label="Remove has notes filter"
            className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      )}
      {filters.needsOrganizing && (
        <Badge variant="outline" className="gap-1 pr-1.5 py-1 shrink-0">
          Needs organizing
          <button
            onClick={() => onFiltersChange({ ...filters, needsOrganizing: false })}
            aria-label="Remove needs organizing filter"
            className="ml-1 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      )}
      {(activeCount > 1 || (activeCount > 0 && search) || filters.needsOrganizing) && (
        <button
          onClick={() => { onSearchClear(); onFiltersChange({ ...EMPTY_FILTERS, needsOrganizing: false }); }}
          className="text-[12px] text-[var(--accent)] font-medium shrink-0 ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
