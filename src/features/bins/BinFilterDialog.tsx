import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OptionGroup } from '@/components/ui/option-group';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { HUE_RANGES } from '@/lib/colorPalette';
import { cn } from '@/lib/utils';
import type { Area } from '@/types';
import type { BinFilters, SortOption } from './useBins';
import { countActiveFilters, EMPTY_FILTERS } from './useBins';

const sortLabels: Record<SortOption, string> = {
  updated: 'Recently Updated',
  created: 'Recently Created',
  name: 'Name',
  area: 'Area',
};

interface BinFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: BinFilters;
  onFiltersChange: (f: BinFilters) => void;
  availableTags: string[];
  areas: Area[];
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  searchQuery: string;
  onSaveView: () => void;
}

export function BinFilterDialog({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  availableTags,
  areas,
  sort,
  onSortChange,
  searchQuery,
  onSaveView,
}: BinFilterDialogProps) {
  const [draft, setDraft] = useState<BinFilters>(filters);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const getTagStyle = useTagStyle();

  // Sync draft when dialog opens
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setTagsExpanded(false);
    }
  }, [open, filters]);

  function toggleTag(tag: string) {
    setDraft((d) => ({
      ...d,
      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
    }));
  }

  function toggleHueRange(rangeName: string) {
    setDraft((d) => ({
      ...d,
      colors: d.colors.includes(rangeName)
        ? d.colors.filter((c) => c !== rangeName)
        : [...d.colors, rangeName],
    }));
  }

  function toggleArea(areaId: string) {
    setDraft((d) => ({
      ...d,
      areas: d.areas.includes(areaId) ? d.areas.filter((a) => a !== areaId) : [...d.areas, areaId],
    }));
  }

  function apply() {
    onFiltersChange(draft);
    onOpenChange(false);
  }

  function reset() {
    setDraft(EMPTY_FILTERS);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter Bins</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sort */}
          <div className="space-y-2.5">
            <span className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
              Sort
            </span>
            <OptionGroup
              options={(Object.keys(sortLabels) as SortOption[]).map((key) => ({ key, label: sortLabels[key] }))}
              value={sort}
              onChange={onSortChange}
              size="sm"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                Tags
              </span>
              {draft.tags.length >= 2 && (
                <OptionGroup
                  options={[
                    { key: 'any' as const, label: 'Any' },
                    { key: 'all' as const, label: 'All' },
                  ]}
                  value={draft.tagMode}
                  onChange={(mode) => setDraft((d) => ({ ...d, tagMode: mode }))}
                  size="sm"
                />
              )}
            </div>
            {availableTags.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)]">No tags in this location</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const TAG_LIMIT = 12;
                  const sorted = [...availableTags].sort((a, b) => {
                    const aSelected = draft.tags.includes(a);
                    const bSelected = draft.tags.includes(b);
                    if (aSelected !== bSelected) return aSelected ? -1 : 1;
                    return a.localeCompare(b, undefined, { sensitivity: 'base' });
                  });
                  const canCollapse = sorted.length > TAG_LIMIT;
                  const visible = canCollapse && !tagsExpanded ? sorted.slice(0, TAG_LIMIT) : sorted;
                  const hiddenCount = sorted.length - TAG_LIMIT;

                  return (
                    <>
                      {visible.map((tag) => {
                        const selected = draft.tags.includes(tag);
                        const tagStyle = getTagStyle(tag);

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium transition-all cursor-pointer',
                              tagStyle
                                ? selected
                                  ? 'ring-2 ring-[var(--accent)] ring-offset-1'
                                  : 'opacity-60 hover:opacity-80'
                                : selected
                                  ? 'bg-[var(--accent)] text-white'
                                  : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                            )}
                            style={tagStyle}
                          >
                            {tag}
                          </button>
                        );
                      })}
                      {canCollapse && (
                        <button
                          type="button"
                          onClick={() => setTagsExpanded((v) => !v)}
                          className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          {tagsExpanded ? 'Show less' : `+${hiddenCount} more`}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Area */}
          {areas.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                Area
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleArea('__unassigned__')}
                  className={cn(
                    'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium transition-all cursor-pointer',
                    draft.areas.includes('__unassigned__')
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                  )}
                >
                  Unassigned
                </button>
                {areas.map((area) => {
                  const selected = draft.areas.includes(area.id);
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => toggleArea(area.id)}
                      className={cn(
                        'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium transition-all cursor-pointer',
                        selected
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                      )}
                    >
                      {area.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color */}
          <div className="space-y-2.5">
            <span className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
              Color
            </span>
            <div className="flex flex-wrap gap-2">
              {HUE_RANGES.map((range) => {
                const selected = draft.colors.includes(range.name);
                return (
                  <button
                    key={range.name}
                    type="button"
                    onClick={() => toggleHueRange(range.name)}
                    title={range.label}
                    className={cn(
                      'h-8 w-8 rounded-full transition-all',
                      selected
                        ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-elevated)] scale-110'
                        : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: range.dot }}
                  />
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1">
            <span className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
              Content
            </span>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[15px] text-[var(--text-primary)]">Has items</span>
              <Checkbox
                checked={draft.hasItems}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, hasItems: v }))}
              />
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[15px] text-[var(--text-primary)]">Has notes</span>
              <Checkbox
                checked={draft.hasNotes}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, hasNotes: v }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={reset} className="rounded-[var(--radius-full)]">
                Reset
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {(searchQuery || countActiveFilters(draft) > 0) && (
                <Button
                  variant="ghost"
                  onClick={() => { onSaveView(); onOpenChange(false); }}
                  className="rounded-[var(--radius-full)]"
                >
                  Save View
                </Button>
              )}
              <Button onClick={apply} className="rounded-[var(--radius-full)]">
                Apply
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
