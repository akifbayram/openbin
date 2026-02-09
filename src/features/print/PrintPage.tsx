import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBinList } from '@/features/bins/useBins';
import { LabelSheet } from './LabelSheet';
import type { Bin } from '@/types';

export function PrintPage() {
  const [searchParams] = useSearchParams();
  const { bins: allBins, isLoading } = useBinList(undefined, 'name');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      setSelectedIds(new Set(idsParam.split(',')));
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="print-hide flex flex-col gap-4 px-5 pt-6 pb-2">
        <Skeleton className="h-10 w-24" />
        <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="h-[22px] w-[22px] rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selectedBins: Bin[] = allBins.filter((b) => selectedIds.has(b.id));

  function toggleBin(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(allBins.map((b) => b.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  return (
    <>
      <div className="print-hide flex flex-col gap-4 px-5 pt-6 pb-2">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Print
        </h1>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal">Select Bins</Label>
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-[13px] text-[var(--accent)] h-8 px-2.5"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectNone}
                  className="text-[13px] text-[var(--accent)] h-8 px-2.5"
                >
                  None
                </Button>
              </div>
            </div>

            {allBins.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">
                No bins to print. Create some bins first.
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
          </CardContent>
        </Card>

        {selectedBins.length > 0 && (
          <>
            <Button
              onClick={() => window.print()}
              className="w-full rounded-[var(--radius-md)] h-12 text-[17px]"
            >
              <Printer className="h-5 w-5 mr-2.5" />
              Print {selectedBins.length} Label{selectedBins.length !== 1 ? 's' : ''}
            </Button>

            <Card>
              <CardContent>
                <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal mb-3 block">Preview</Label>
                <div className="bg-white rounded-[var(--radius-md)] p-4 overflow-auto dark:border dark:border-[var(--border-subtle)]">
                  <LabelSheet bins={selectedBins} />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="print-show">
        <LabelSheet bins={selectedBins} />
      </div>
    </>
  );
}
