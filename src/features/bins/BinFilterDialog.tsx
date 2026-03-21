import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OptionGroup } from '@/components/ui/option-group';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { cn } from '@/lib/utils';
import type { Area } from '@/types';
import { buildAreaTree, flattenAreaTree } from '../areas/useAreas';
import type { BinFilters, SortOption } from './useBins';
import { countActiveFilters, EMPTY_FILTERS } from './useBins';

const sortLabels: Record<SortOption, string> = {
  updated: 'Updated',
  created: 'Created',
  name: 'Name',
  area: 'Area',
};

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
        {label}
      </span>
      {count != null && count > 0 && (
        <span className="text-[11px] font-semibold bg-[var(--accent)] text-[var(--text-on-accent)] rounded-[var(--radius-xs)] px-1.5 py-0.5 leading-none tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}

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

  const activeCount = countActiveFilters(draft);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter Bins</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Sort */}
          <div className="space-y-2.5">
            <SectionHeader label="Sort" />
            <OptionGroup
              options={(Object.keys(sortLabels) as SortOption[]).map((key) => ({ key, label: sortLabels[key] }))}
              value={sort}
              onChange={onSortChange}
              size="sm"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2.5">
            <div className="row-spread">
              <SectionHeader label="Tags" count={draft.tags.length} />
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
              <p className="text-[13px] text-[var(--text-tertiary)] italic">No tags in this location</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const TAG_LIMIT = 12;
                  const canCollapse = availableTags.length > TAG_LIMIT;
                  const visible = canCollapse && !tagsExpanded ? availableTags.slice(0, TAG_LIMIT) : availableTags;
                  const hiddenCount = availableTags.length - TAG_LIMIT;

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
                              'inline-flex items-center rounded-[var(--radius-xs)] px-2.5 py-1 text-[12px] font-medium transition-all duration-150 cursor-pointer',
                              tagStyle
                                ? selected
                                  ? ''
                                  : 'opacity-40 hover:opacity-60'
                                : selected
                                  ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
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
              <SectionHeader label="Area" count={draft.areas.length} />
              <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => toggleArea('__unassigned__')}
                    className={cn(
                      'inline-flex items-center rounded-[var(--radius-xs)] px-2.5 py-1 text-[12px] font-medium transition-all duration-150 cursor-pointer w-fit',
                      draft.areas.includes('__unassigned__')
                        ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                        : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                    )}
                  >
                    Unassigned
                  </button>
                  {flattenAreaTree(buildAreaTree(areas)).map((area) => {
                    const selected = draft.areas.includes(area.id);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => toggleArea(area.id)}
                        className={cn(
                          'inline-flex items-center rounded-[var(--radius-xs)] px-2.5 py-1 text-[12px] font-medium transition-all duration-150 cursor-pointer w-fit',
                          selected
                            ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                            : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                        )}
                        style={area.depth > 0 ? { marginLeft: area.depth * 16 } : undefined}
                      >
                        {area.name}
                      </button>
                    );
                  })}
                </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <div className="row-spread w-full">
            <div className="row">
              <Button variant="ghost" onClick={reset}>
                Reset
              </Button>
            </div>
            <div className="row">
              {(searchQuery || activeCount > 0) && (
                <Button
                  variant="ghost"
                  onClick={() => { onSaveView(); onOpenChange(false); }}
                >
                  Save View
                </Button>
              )}
              <Button onClick={apply}>
                {activeCount > 0 ? `Apply (${activeCount})` : 'Apply'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
