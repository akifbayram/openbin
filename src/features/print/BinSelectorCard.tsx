import { CheckCircle2, ChevronDown, Circle, Package } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { resolveColor } from '@/lib/colorPalette';
import { useTerminology } from '@/lib/terminology';
import { categoryHeader, cn } from '@/lib/utils';
import type { Area, Bin } from '@/types';
import { buildAreaTree, flattenAreaTree } from '../areas/useAreas';

interface BinSelectorCardProps {
  allBins: Bin[];
  areas: Area[];
  selectedIds: Set<string>;
  toggleBin: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  toggleArea: (areaId: string | null) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function BinSelectorCard({
  allBins,
  areas,
  selectedIds,
  toggleBin,
  selectAll,
  selectNone,
  toggleArea,
  expanded,
  onExpandedChange,
}: BinSelectorCardProps) {
  const t = useTerminology();

  const grouped = useMemo(() => {
    const groups: { areaId: string | null; label: string; depth: number; bins: Bin[] }[] = [];
    const flatAreas = flattenAreaTree(buildAreaTree(areas));
    for (const area of flatAreas) {
      const areaBins = allBins.filter((b) => b.area_id === area.id);
      if (areaBins.length > 0) groups.push({ areaId: area.id, label: area.name, depth: area.depth, bins: areaBins });
    }
    const unassigned = allBins.filter((b) => !b.area_id);
    if (unassigned.length > 0) groups.push({ areaId: null, label: 'Unassigned', depth: 0, bins: unassigned });
    return groups;
  }, [allBins, areas]);

  return (
    <Card>
      <CardContent>
        <button
          type="button"
          className="row-spread w-full"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="row">
            <Package className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Select {t.Bins}</Label>
            {!expanded && selectedIds.size > 0 && (
              <span className="text-[13px] text-[var(--text-tertiary)]">
                ({selectedIds.size} of {allBins.length})
              </span>
            )}
          </div>
          <ChevronDown className={cn(
            'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180'
          )} />
        </button>

        {expanded && (
          allBins.length === 0 ? (
            <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">
              No {t.bins} to print. Create some {t.bins} first.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mt-2">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-[13px] text-[var(--accent)] h-8 px-2.5">All</Button>
                <Button variant="ghost" size="sm" onClick={selectNone} className="text-[13px] text-[var(--accent)] h-8 px-2.5">None</Button>
                <span className="text-[12px] text-[var(--text-tertiary)] ml-auto tabular-nums">
                  {selectedIds.size} of {allBins.length} selected
                </span>
              </div>

              {grouped.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
                  {grouped.map((group) => {
                    const allSelected = group.bins.length > 0 && group.bins.every((b) => selectedIds.has(b.id));
                    return (
                      <button
                        key={group.areaId ?? 'unassigned'}
                        type="button"
                        onClick={() => toggleArea(group.areaId)}
                        className={cn(
                          'inline-flex items-center px-3 py-1.5 rounded-[var(--radius-xs)] text-[12px] font-medium transition-colors',
                          allSelected
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--bg-input)] hover:bg-[var(--bg-active)]',
                          !allSelected && (group.areaId != null ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)] italic')
                        )}
                      >
                        {group.label}
                        <span className={cn('ml-1', allSelected ? 'text-white/70' : 'text-[var(--text-tertiary)]')}>({group.bins.length})</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <div className="space-y-0.5 max-h-[50vh] lg:max-h-80 overflow-y-auto -mx-2">
                  {grouped.map((group) => (
                    <div key={group.areaId ?? 'unassigned'}>
                      {grouped.length > 1 && (
                        <div className={cn(categoryHeader, 'px-3 pt-3 pb-1')}>
                          {group.label}
                        </div>
                      )}
                      {group.bins.map((bin) => {
                        const checked = selectedIds.has(bin.id);
                        const colorPreset = bin.color ? resolveColor(bin.color) : null;
                        return (
                          <button
                            type="button"
                            key={bin.id}
                            className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 w-full text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] transition-colors"
                            onClick={() => toggleBin(bin.id)}
                          >
                            {checked ? (
                              <CheckCircle2 className="h-[22px] w-[22px] text-[var(--accent)] shrink-0" />
                            ) : (
                              <Circle className="h-[22px] w-[22px] text-[var(--text-tertiary)] shrink-0" />
                            )}
                            {colorPreset && (
                              <div
                                className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-[var(--border-subtle)]"
                                style={{ backgroundColor: colorPreset.bg }}
                              />
                            )}
                            <span className="text-[15px] text-[var(--text-primary)] truncate">{bin.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        )}
      </CardContent>
    </Card>
  );
}
