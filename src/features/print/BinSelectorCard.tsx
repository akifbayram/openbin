import { CheckCircle2, Circle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';
import type { Bin, Area } from '@/types';

interface BinSelectorCardProps {
  allBins: Bin[];
  areas: Area[];
  selectedIds: Set<string>;
  toggleBin: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectByArea: (areaId: string | null) => void;
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
  selectByArea,
  expanded,
  onExpandedChange,
}: BinSelectorCardProps) {
  const t = useTerminology();

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between w-full">
          <button
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={() => onExpandedChange(!expanded)}
          >
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Select {t.Bins}</Label>
            <span className="text-[13px] text-[var(--text-tertiary)]">({selectedIds.size} selected)</span>
            <ChevronDown className={cn(
              'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
              expanded && 'rotate-180'
            )} />
          </button>
          <div className="flex gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-[13px] text-[var(--accent)] h-8 px-2.5">All</Button>
            <Button variant="ghost" size="sm" onClick={selectNone} className="text-[13px] text-[var(--accent)] h-8 px-2.5">None</Button>
          </div>
        </div>

        {expanded && (
          <>
            {areas.length > 0 && allBins.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
                {areas.map((area) => {
                  const count = allBins.filter((b) => b.area_id === area.id).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => selectByArea(area.id)}
                      className="inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors"
                    >
                      {area.name}
                      <span className="ml-1 text-[var(--text-tertiary)]">({count})</span>
                    </button>
                  );
                })}
                {allBins.some((b) => !b.area_id) && (
                  <button
                    type="button"
                    onClick={() => selectByArea(null)}
                    className="inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium bg-[var(--bg-input)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] transition-colors italic"
                  >
                    Unassigned
                    <span className="ml-1">({allBins.filter((b) => !b.area_id).length})</span>
                  </button>
                )}
              </div>
            )}
            {allBins.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">
                No {t.bins} to print. Create some {t.bins} first.
              </p>
            ) : (
              <div className="space-y-0.5 max-h-80 overflow-y-auto -mx-2">
                {allBins.map((bin) => {
                  const checked = selectedIds.has(bin.id);
                  return (
                    <button
                      key={bin.id}
                      className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 w-full text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] transition-colors"
                      onClick={() => toggleBin(bin.id)}
                    >
                      {checked ? (
                        <CheckCircle2 className="h-[22px] w-[22px] text-[var(--accent)] shrink-0" />
                      ) : (
                        <Circle className="h-[22px] w-[22px] text-[var(--text-tertiary)] shrink-0" />
                      )}
                      <span className="text-[15px] text-[var(--text-primary)] truncate">{bin.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
