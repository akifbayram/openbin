import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { COLOR_PALETTE, getColorPreset } from '@/lib/colorPalette';
import { useTagColorsContext } from '@/features/tags/TagColorsContext';
import { useTheme } from '@/lib/theme';
import { useAreaList } from '@/features/areas/useAreas';
import { useAuth } from '@/lib/auth';
import type { BinFilters } from './useBins';
import { EMPTY_FILTERS } from './useBins';

interface BinFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: BinFilters;
  onFiltersChange: (f: BinFilters) => void;
  availableTags: string[];
}

export function BinFilterDialog({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  availableTags,
}: BinFilterDialogProps) {
  const [draft, setDraft] = useState<BinFilters>(filters);
  const { tagColors } = useTagColorsContext();
  const { theme } = useTheme();
  const { activeLocationId } = useAuth();
  const { areas } = useAreaList(activeLocationId);

  // Sync draft when dialog opens
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  function toggleTag(tag: string) {
    setDraft((d) => ({
      ...d,
      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
    }));
  }

  function toggleColor(key: string) {
    setDraft((d) => ({
      ...d,
      colors: d.colors.includes(key) ? d.colors.filter((c) => c !== key) : [...d.colors, key],
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
          {/* Tags */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                Tags
              </span>
              {draft.tags.length >= 2 && (
                <div className="flex rounded-[var(--radius-full)] bg-[var(--bg-input)] p-0.5">
                  {(['any', 'all'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, tagMode: mode }))}
                      className={cn(
                        'px-3 py-1 text-[12px] font-medium rounded-[var(--radius-full)] transition-colors capitalize',
                        draft.tagMode === mode
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-secondary)]'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {availableTags.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)]">No tags in this location</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const selected = draft.tags.includes(tag);
                  const colorKey = tagColors.get(tag);
                  const preset = colorKey ? getColorPreset(colorKey) : undefined;

                  const style: React.CSSProperties = preset
                    ? {
                        backgroundColor: theme === 'dark' ? preset.bgDark : preset.bg,
                        color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)',
                      }
                    : {};

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium transition-all cursor-pointer',
                        preset
                          ? selected
                            ? 'ring-2 ring-[var(--accent)] ring-offset-1'
                            : 'opacity-60 hover:opacity-80'
                          : selected
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                      )}
                      style={preset ? style : undefined}
                    >
                      {tag}
                    </button>
                  );
                })}
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
              {COLOR_PALETTE.map((c) => {
                const selected = draft.colors.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleColor(c.key)}
                    title={c.label}
                    className={cn(
                      'h-8 w-8 rounded-full transition-all',
                      selected
                        ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-elevated)] scale-110'
                        : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: c.dot }}
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
          <Button variant="ghost" onClick={reset} className="rounded-[var(--radius-full)]">
            Reset
          </Button>
          <Button onClick={apply} className="rounded-[var(--radius-full)]">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
