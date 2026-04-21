import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OptionGroup } from '@/components/ui/option-group';
import type { SortDirection } from '@/components/ui/sort-header';
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
  last_used: 'Last used',
};

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="ui-group-label">
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

function AreaPill({
  name,
  prefix,
  selected,
  onToggle,
}: {
  name: string;
  prefix?: string | null;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center rounded-[var(--radius-xs)] px-2.5 py-1 text-[12px] font-medium transition-all duration-150 cursor-pointer',
        selected
          ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
          : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]',
      )}
    >
      {prefix && <span className="opacity-50">{prefix} → </span>}
      {name}
    </button>
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
  sortDir: SortDirection;
  onSortDirChange: (dir: SortDirection) => void;
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
  sortDir,
  onSortDirChange,
  searchQuery,
  onSaveView,
}: BinFilterDialogProps) {
  const [draft, setDraft] = useState<BinFilters>(filters);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const getTagStyle = useTagStyle();
  const [orderedAreas, areaPrefixes] = useMemo(() => {
    const ordered = flattenAreaTree(buildAreaTree(areas));
    const map = new Map<string, Area>();
    for (const a of areas) map.set(a.id, a);
    const prefixes = new Map<string, string>();
    for (const area of areas) {
      if (!area.parent_id) continue;
      const parts: string[] = [];
      let cur = map.get(area.parent_id);
      while (cur) {
        parts.unshift(cur.name);
        cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
      }
      prefixes.set(area.id, parts.join(' → '));
    }
    return [ordered, prefixes] as const;
  }, [areas]);

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
            <div className="row-spread">
              <SectionHeader label="Sort" />
              <button
                type="button"
                onClick={() => onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-2 py-1 text-[12px] font-medium',
                  'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors cursor-pointer',
                )}
              >
                {sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {sortDir === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
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
              <div className="flex flex-wrap gap-1">
                <AreaPill
                  name="Unassigned"
                  selected={draft.areas.includes('__unassigned__')}
                  onToggle={() => toggleArea('__unassigned__')}
                />
                {orderedAreas.map((area) => (
                  <AreaPill
                    key={area.id}
                    name={area.name}
                    prefix={areaPrefixes.get(area.id)}
                    selected={draft.areas.includes(area.id)}
                    onToggle={() => toggleArea(area.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Usage — filter by last-used date */}
          <div className="space-y-2.5">
            <SectionHeader label="Usage" count={draft.unusedSince ? 1 : 0} />
            <div className="flex items-center gap-2">
              <label htmlFor="unused-since-date" className="text-[13px] text-[var(--text-secondary)]">Unused since</label>
              <input
                id="unused-since-date"
                type="date"
                value={draft.unusedSince ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, unusedSince: e.target.value || undefined }))
                }
                className="rounded-[var(--radius-xs)] bg-[var(--bg-input)] border border-[var(--border-flat)] px-2.5 py-1 text-[13px] text-[var(--text-primary)]"
              />
              {draft.unusedSince && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, unusedSince: undefined }))}
                  className="text-[12px] text-[var(--accent)] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

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
