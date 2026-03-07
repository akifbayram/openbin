import { ChevronDown, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreaList } from '@/features/areas/useAreas';
import { useBinList } from '@/features/bins/useBins';
import { BinSelectorCard } from '@/features/print/BinSelectorCard';
import { useBinSelection } from '@/features/print/useBinSelection';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import { ReorganizePreview } from './ReorganizePreview';
import type { ReorgOptions } from './useReorganize';
import { useReorganize } from './useReorganize';

export function ReorganizePage() {
  const navigate = useNavigate();
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { bins: allBins, isLoading } = useBinList(undefined, 'name');
  const { areas } = useAreaList(activeLocationId);
  const selection = useBinSelection(allBins);

  const [maxBins, setMaxBins] = useState<string>('');
  const [userNotes, setUserNotes] = useState('');
  const [strictness, setStrictness] = useState<NonNullable<ReorgOptions['strictness']>>('moderate');
  const [granularity, setGranularity] = useState<NonNullable<ReorgOptions['granularity']>>('medium');
  const [ambiguousPolicy, setAmbiguousPolicy] = useState<NonNullable<ReorgOptions['ambiguousPolicy']>>('best-fit');
  const [duplicates, setDuplicates] = useState<NonNullable<ReorgOptions['duplicates']>>('force-single');
  const [outliers, setOutliers] = useState<NonNullable<ReorgOptions['outliers']>>('force-closest');
  const [minItemsPerBin, setMinItemsPerBin] = useState<string>('');
  const [maxItemsPerBin, setMaxItemsPerBin] = useState<string>('');
  const [binsExpanded, setBinsExpanded] = useState(true);
  const [optionsExpanded, setOptionsExpanded] = useState(true);

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

  // Derive area from selected bins (if all in same area)
  const selectedAreaId = useMemo(() => {
    if (selection.selectedBins.length === 0) return undefined;
    const first = selection.selectedBins[0].area_id;
    return selection.selectedBins.every((b) => b.area_id === first) ? first : undefined;
  }, [selection.selectedBins]);

  const selectedAreaName = useMemo(
    () => areas.find((a) => a.id === selectedAreaId)?.name,
    [areas, selectedAreaId],
  );

  const handleReorganize = useCallback(() => {
    if (selection.selectedBins.length < 2) return;
    const max = maxBins ? Number.parseInt(maxBins, 10) : undefined;
    startReorg(selection.selectedBins, max, selectedAreaId ?? undefined, selectedAreaName, {
      userNotes: userNotes || undefined,
      strictness,
      granularity,
      ambiguousPolicy,
      duplicates,
      outliers,
      minItemsPerBin: minItemsPerBin ? Number.parseInt(minItemsPerBin, 10) : undefined,
      maxItemsPerBin: maxItemsPerBin ? Number.parseInt(maxItemsPerBin, 10) : undefined,
    });
  }, [selection.selectedBins, maxBins, startReorg, selectedAreaId, selectedAreaName, userNotes, strictness, granularity, ambiguousPolicy, duplicates, outliers, minItemsPerBin, maxItemsPerBin]);

  const handleAccept = useCallback(() => {
    apply(
      selection.selectedBins.map((b) => b.id),
      selectedAreaId ?? undefined,
    ).then(() => {
      navigate('/bins');
    });
  }, [apply, selection.selectedBins, selectedAreaId, navigate]);

  const hasProposal = result || partialResult.bins.length > 0;
  const itemCount = selection.selectedBins.reduce((sum, b) => sum + b.items.length, 0);

  if (isLoading) {
    return (
      <div className="page-content max-w-6xl">
        <PageHeader title="Reorganize" back />
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent>
                  <div className="row">
                    <Skeleton className="h-4 w-4 rounded shrink-0" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden lg:block">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content max-w-6xl">
      <PageHeader title="Reorganize" back />

      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
        {/* Left column — settings */}
        <div className="flex flex-col gap-4">
          <BinSelectorCard
            allBins={allBins}
            areas={areas}
            selectedIds={selection.selectedIds}
            toggleBin={selection.toggleBin}
            selectAll={selection.selectAll}
            selectNone={selection.selectNone}
            selectByArea={selection.selectByArea}
            expanded={binsExpanded}
            onExpandedChange={setBinsExpanded}
          />

          <Card>
            <CardContent>
              <button
                type="button"
                className="row-spread w-full"
                onClick={() => setOptionsExpanded(!optionsExpanded)}
              >
                <div className="row">
                  <SlidersHorizontal className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Options</Label>
                </div>
                <ChevronDown className={cn(
                  'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
                  optionsExpanded && 'rotate-180'
                )} />
              </button>

              {optionsExpanded && (
                <div className="mt-3 space-y-4">
                  <div className="px-1">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                      Max {t.bins} (optional)
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={maxBins}
                      onChange={(e) => setMaxBins(e.target.value)}
                      placeholder="AI decides"
                    />
                  </div>

                  <div className="px-1">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                      Items per {t.bin} (optional)
                    </span>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={minItemsPerBin}
                        onChange={(e) => setMinItemsPerBin(e.target.value)}
                        placeholder="Min"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={maxItemsPerBin}
                        onChange={(e) => setMaxItemsPerBin(e.target.value)}
                        placeholder="Max"
                      />
                    </div>
                  </div>

                  <div className="px-1">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                      Notes for AI (optional)
                    </span>
                    <Textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="e.g. Keep kitchen items separate from garage tools"
                      rows={2}
                    />
                  </div>

                  <div className="px-1">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                      Strictness
                    </span>
                    <OptionGroup
                      options={[
                        { key: 'conservative', label: 'Conservative' },
                        { key: 'moderate', label: 'Moderate' },
                        { key: 'aggressive', label: 'Aggressive' },
                      ]}
                      value={strictness}
                      onChange={setStrictness}
                      shape="rounded"
                      size="sm"
                    />
                  </div>

                  <div className="px-1">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                      Topic Granularity
                    </span>
                    <OptionGroup
                      options={[
                        { key: 'broad', label: 'Broad' },
                        { key: 'medium', label: 'Medium' },
                        { key: 'specific', label: 'Specific' },
                      ]}
                      value={granularity}
                      onChange={setGranularity}
                      shape="rounded"
                      size="sm"
                    />
                  </div>

                  <div className="px-1">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                      Ambiguous Items
                    </span>
                    <OptionGroup
                      options={[
                        { key: 'best-fit', label: 'Best Fit' },
                        { key: 'multi-bin', label: 'Multi-Bin' },
                        { key: 'misc-bin', label: 'Misc Bin' },
                      ]}
                      value={ambiguousPolicy}
                      onChange={setAmbiguousPolicy}
                      shape="rounded"
                      size="sm"
                    />
                  </div>

                  <div className="px-1">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                      Duplicates
                    </span>
                    <OptionGroup
                      options={[
                        { key: 'force-single', label: 'Single Placement' },
                        { key: 'allow', label: 'Allow Duplicates' },
                      ]}
                      value={duplicates}
                      onChange={setDuplicates}
                      shape="rounded"
                      size="sm"
                    />
                  </div>

                  <div className="px-1">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                      Outlier Items
                    </span>
                    <OptionGroup
                      options={[
                        { key: 'force-closest', label: 'Force Closest' },
                        { key: 'dedicated', label: 'Outlier Bin' },
                      ]}
                      value={outliers}
                      onChange={setOutliers}
                      shape="rounded"
                      size="sm"
                    />
                  </div>

                  <div className="px-1 text-[12px] text-[var(--text-tertiary)]">
                    {selection.selectedIds.size} {selection.selectedIds.size === 1 ? t.bin : t.bins} selected · {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right column — preview (sticky on desktop) */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">
          <Button
            onClick={handleReorganize}
            disabled={selection.selectedIds.size < 2 || isStreaming}
            className="h-12 text-[17px] shadow-[0_2px_12px_var(--accent-glow)] rounded-[var(--radius-md)]"
            fullWidth
          >
            <Sparkles className="h-5 w-5 mr-2.5" />
            Reorganize {selection.selectedIds.size} {selection.selectedIds.size === 1 ? t.bin : t.bins}
          </Button>
          {(error || applyError) && (
            <Card className="border-t-2 border-t-[var(--destructive)]">
              <CardContent>
                <p className="text-sm text-[var(--destructive)]">{error || applyError}</p>
              </CardContent>
            </Card>
          )}

          {(hasProposal || isStreaming) ? (
            <Card>
              <CardContent>
                <ReorganizePreview
                  result={result}
                  partialResult={partialResult}
                  isStreaming={isStreaming}
                  isApplying={isApplying}
                  originalCount={selection.selectedIds.size}
                  onAccept={handleAccept}
                  onCancel={clear}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="hidden lg:block">
              <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-subtle)]">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-[var(--bg-input)] p-3.5 mb-4">
                    <Sparkles className="h-6 w-6 text-[var(--text-tertiary)]" />
                  </div>
                  <p className="text-[15px] font-medium text-[var(--text-secondary)] mb-1">
                    No proposal yet
                  </p>
                  <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs">
                    Select at least 2 {t.bins} and click Reorganize to let AI suggest a better organization.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
