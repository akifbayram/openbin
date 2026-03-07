import { Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAreaList } from '@/features/areas/useAreas';
import { useBinList } from '@/features/bins/useBins';
import { useAuth } from '@/lib/auth';
import { ReorganizePreview } from './ReorganizePreview';
import { useReorganize } from './useReorganize';

export function ReorganizePage() {
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const { bins, isLoading: binsLoading } = useBinList();
  const { areas } = useAreaList(activeLocationId);

  const [selectedArea, setSelectedArea] = useState<string>('');
  const [maxBins, setMaxBins] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    result,
    partialResult,
    isStreaming,
    error,
    applyError,
    isApplying,
    startReorg,
    apply,
    clear,
  } = useReorganize();

  const filteredBins = useMemo(() => {
    if (!selectedArea) return bins;
    return bins.filter((b) => b.area_id === selectedArea);
  }, [bins, selectedArea]);

  const visibleIds = useMemo(() => new Set(filteredBins.map((b) => b.id)), [filteredBins]);

  // If user hasn't explicitly toggled, select all visible
  const effectiveSelection = useMemo(() => {
    if (selectedIds.size === 0) return visibleIds;
    const s = new Set<string>();
    for (const id of selectedIds) {
      if (visibleIds.has(id)) s.add(id);
    }
    return s;
  }, [selectedIds, visibleIds]);

  const selectedBins = useMemo(
    () => filteredBins.filter((b) => effectiveSelection.has(b.id)),
    [filteredBins, effectiveSelection],
  );

  const toggleBin = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedIds(new Set()), []);

  const selectedAreaObj = areas.find((a) => a.id === selectedArea);

  const handleReorganize = useCallback(() => {
    if (selectedBins.length < 2) return;
    const max = maxBins ? Number.parseInt(maxBins, 10) : undefined;
    startReorg(selectedBins, max, selectedAreaObj?.id, selectedAreaObj?.name);
  }, [selectedBins, maxBins, startReorg, selectedAreaObj]);

  const handleAccept = useCallback(() => {
    apply(
      selectedBins.map((b) => b.id),
      selectedAreaObj?.id,
    ).then(() => {
      navigate('/bins');
    });
  }, [apply, selectedBins, selectedAreaObj, navigate]);

  const handleCancel = useCallback(() => {
    clear();
  }, [clear]);

  const hasProposal = result || partialResult.bins.length > 0;
  const itemCount = selectedBins.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <div className="min-h-dvh flex flex-col gap-6 px-6 py-6 max-w-4xl mx-auto">
      <PageHeader title="Reorganize Bins" back />

      {!hasProposal && !isStreaming && (
        <Card className="p-5 stack-4">
          <div className="stack-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Area (optional)
            </label>
            <select
              value={selectedArea}
              onChange={(e) => {
                setSelectedArea(e.target.value);
                setSelectedIds(new Set());
                clear();
              }}
              className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-base)] px-3 py-2 text-sm"
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="stack-1">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Max bins (optional)
            </label>
            <input
              type="number"
              min={1}
              value={maxBins}
              onChange={(e) => setMaxBins(e.target.value)}
              placeholder="AI decides"
              className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-base)] px-3 py-2 text-sm"
            />
          </div>

          <div className="stack-2">
            <div className="flex-row-2 items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {effectiveSelection.size} of {filteredBins.length} bins selected · {itemCount} items
              </span>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select all
              </Button>
            </div>

            {binsLoading ? (
              <div className="py-8 text-center text-sm text-[var(--text-tertiary)]">
                Loading bins...
              </div>
            ) : filteredBins.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--text-tertiary)]">
                No bins found
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto stack-1">
                {filteredBins.map((bin) => (
                  <label
                    key={bin.id}
                    className="flex-row-2 items-center px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={effectiveSelection.has(bin.id)}
                      onChange={() => toggleBin(bin.id)}
                      className="rounded"
                    />
                    <span className="flex-1 truncate">{bin.name}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {bin.items.length} item{bin.items.length !== 1 ? 's' : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleReorganize} disabled={effectiveSelection.size < 2 || isStreaming} fullWidth>
            <Sparkles className="icon-4 mr-2" />
            Reorganize {effectiveSelection.size} bins
          </Button>
        </Card>
      )}

      {(error || applyError) && (
        <div className="rounded-lg bg-[var(--destructive-bg)] p-3 text-sm text-[var(--destructive)]">
          {error || applyError}
        </div>
      )}

      {(hasProposal || isStreaming) && (
        <ReorganizePreview
          result={result}
          partialResult={partialResult}
          isStreaming={isStreaming}
          isApplying={isApplying}
          originalCount={effectiveSelection.size}
          onAccept={handleAccept}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
