import { AlertCircle, ChevronDown, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OptionGroupOption } from '@/components/ui/option-group';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAreaList } from '@/features/areas/useAreas';
import { useBinList } from '@/features/bins/useBins';
import { BinSelectorCard } from '@/features/print/BinSelectorCard';
import { useBinSelection } from '@/features/print/useBinSelection';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import { usePlan } from '@/lib/usePlan';
import { cn } from '@/lib/utils';
import { ReorganizePreview } from './ReorganizePreview';
import type { ReorgOptions } from './useReorganize';
import { useReorganize } from './useReorganize';

const UpgradePrompt = __EE__
  ? lazy(() => import('@/ee/UpgradePrompt').then(m => ({ default: m.UpgradePrompt })))
  : (() => null) as React.FC<Record<string, unknown>>;

interface OptionFieldConfig<K extends string> {
  legend: string;
  options: OptionGroupOption<K>[];
  value: K;
  onChange: (v: K) => void;
  hint?: string;
}

export function ReorganizePage() {
  const navigate = useNavigate();
  const t = useTerminology();
  const { showToast } = useToast();
  const { activeLocationId } = useAuth();
  const { canWrite, isLoading: permissionsLoading } = usePermissions();
  const { isGated, isSelfHosted, planInfo } = usePlan();
  const reorganizeGated = !isSelfHosted && isGated('reorganize');
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
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reorgRef = useRef<HTMLDivElement>(null);

  const {
    result,
    partialResult,
    isStreaming,
    error,
    applyError,
    isApplying,
    retryCount,
    startReorg,
    apply,
    cancel,
    clear,
  } = useReorganize();

  const [showProgress, setShowProgress] = useState(false);
  const progressComplete = !isStreaming && !!result;

  useEffect(() => {
    if (isStreaming) {
      setShowProgress(true);
      return;
    }
    if (!progressComplete) return;
    const id = setTimeout(() => setShowProgress(false), 800);
    return () => clearTimeout(id);
  }, [isStreaming, progressComplete]);

  const selectedAreaId = useMemo(() => {
    if (selection.selectedBins.length === 0) return undefined;
    const first = selection.selectedBins[0].area_id;
    return selection.selectedBins.every((b) => b.area_id === first) ? first : undefined;
  }, [selection.selectedBins]);

  const selectedAreaName = useMemo(
    () => areas.find((a) => a.id === selectedAreaId)?.name,
    [areas, selectedAreaId],
  );

  const minVal = minItemsPerBin ? Number.parseInt(minItemsPerBin, 10) : undefined;
  const maxVal = maxItemsPerBin ? Number.parseInt(maxItemsPerBin, 10) : undefined;
  const maxBinsVal = maxBins ? Number.parseInt(maxBins, 10) : undefined;
  const rangeError =
    minVal != null && maxVal != null && minVal > maxVal
      ? 'Min must be less than max'
      : undefined;
  const maxBinsError =
    maxBinsVal != null && maxBinsVal < 1 ? 'Must be at least 1' : undefined;
  const hasValidationError = !!rangeError || !!maxBinsError;

  const handleReorganize = useCallback(() => {
    if (selection.selectedBins.length < 2 || hasValidationError) return;
    startReorg(
      selection.selectedBins,
      maxBinsVal,
      selectedAreaId ?? undefined,
      selectedAreaName,
      {
        userNotes: userNotes || undefined,
        strictness,
        granularity,
        ambiguousPolicy,
        duplicates,
        outliers,
        minItemsPerBin: minVal,
        maxItemsPerBin: maxVal,
      },
    );
    reorgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selection.selectedBins, maxBinsVal, startReorg, selectedAreaId, selectedAreaName, hasValidationError, userNotes, strictness, granularity, ambiguousPolicy, duplicates, outliers, minVal, maxVal]);

  const handleRegenerate = useCallback(() => {
    clear();
    handleReorganize();
  }, [clear, handleReorganize]);

  const handleAccept = useCallback(() => {
    apply(
      selection.selectedBins.map((b) => b.id),
      selectedAreaId ?? undefined,
    ).then(() => {
      showToast({
        message: `Reorganization applied — ${result?.bins.length ?? 0} ${t.bins} created`,
        variant: 'success',
      });
      navigate('/bins');
    });
  }, [apply, selection.selectedBins, selectedAreaId, navigate, showToast, result, t.bins]);

  const handleCancel = useCallback(() => {
    if (isStreaming) cancel();
    clear();
  }, [isStreaming, cancel, clear]);

  const hasProposal = result || partialResult.bins.length > 0;
  const itemCount = useMemo(
    () => selection.selectedBins.reduce((sum, b) => sum + b.items.length, 0),
    [selection.selectedBins],
  );
  const canSubmit = selection.selectedIds.size >= 2 && !isStreaming && !hasValidationError;

  const optionFields: OptionFieldConfig<string>[] = [
    {
      legend: 'Change level',
      options: [
        { key: 'conservative', label: 'Light' },
        { key: 'moderate', label: 'Moderate' },
        { key: 'aggressive', label: 'Thorough' },
      ],
      value: strictness,
      onChange: setStrictness as (v: string) => void,
      hint: `How much the AI can restructure your ${t.bins}`,
    },
    {
      legend: 'Grouping',
      options: [
        { key: 'broad', label: 'Broad' },
        { key: 'medium', label: 'Medium' },
        { key: 'specific', label: 'Specific' },
      ],
      value: granularity,
      onChange: setGranularity as (v: string) => void,
      hint: 'How narrowly items are categorized',
    },
    {
      legend: 'Unmatched items',
      options: [
        { key: 'best-fit', label: 'Best match' },
        { key: 'multi-bin', label: 'Place in multiple' },
        { key: 'misc-bin', label: `Misc ${t.bin}` },
      ],
      value: ambiguousPolicy,
      onChange: setAmbiguousPolicy as (v: string) => void,
      hint: "What happens to items that don't fit neatly",
    },
    {
      legend: 'Duplicate items',
      options: [
        { key: 'force-single', label: `One ${t.bin} only` },
        { key: 'allow', label: 'Allow copies' },
      ],
      value: duplicates,
      onChange: setDuplicates as (v: string) => void,
    },
    {
      legend: 'Outlier items',
      options: [
        { key: 'force-closest', label: 'Nearest match' },
        { key: 'dedicated', label: `Separate ${t.bin}` },
      ],
      value: outliers,
      onChange: setOutliers as (v: string) => void,
    },
  ];

  useEffect(() => {
    if (!permissionsLoading && !canWrite) {
      navigate('/', { replace: true });
    }
  }, [permissionsLoading, canWrite, navigate]);

  if (!permissionsLoading && !canWrite) {
    return null;
  }

  if (reorganizeGated) {
    return (
      <div className="page-content max-w-6xl">
        <PageHeader title="Reorganize" back />
        {__EE__ && (
          <Suspense fallback={null}>
            <UpgradePrompt
              feature="Reorganize"
              description={`AI-powered ${t.bin} reorganization is available on the Pro plan.`}
              upgradeUrl={planInfo.upgradeUrl}
            />
          </Suspense>
        )}
      </div>
    );
  }

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
          <div className="hidden lg:flex lg:flex-col lg:gap-4">
            <Skeleton className="h-12 w-full rounded-[var(--radius-md)]" />
            <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-subtle)]">
              <div className="flex flex-col items-center gap-3 py-16">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content max-w-6xl">
      <PageHeader title="Reorganize" back />

      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
        <div className="flex flex-col gap-4">
          <BinSelectorCard
            allBins={allBins}
            areas={areas}
            selectedIds={selection.selectedIds}
            toggleBin={selection.toggleBin}
            selectAll={selection.selectAll}
            selectNone={selection.selectNone}
            toggleArea={selection.toggleArea}
            expanded={binsExpanded}
            onExpandedChange={setBinsExpanded}
          />

          <Card>
            <CardContent>
              <button
                type="button"
                className="row-spread w-full"
                aria-expanded={optionsExpanded}
                aria-controls="reorganize-options"
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

              <div
                id="reorganize-options"
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: optionsExpanded ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="mt-3 space-y-4">
                    <div>
                      <Label htmlFor="reorg-max-bins" className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                        Number of {t.bins}
                      </Label>
                      <Input
                        id="reorg-max-bins"
                        type="number"
                        min={1}
                        value={maxBins}
                        onChange={(e) => setMaxBins(e.target.value)}
                        placeholder="Auto"
                        aria-describedby={maxBinsError ? 'reorg-max-bins-error' : undefined}
                        aria-invalid={!!maxBinsError}
                      />
                      {maxBinsError && (
                        <p id="reorg-max-bins-error" className="text-[12px] text-[var(--destructive)] mt-1" role="alert">
                          {maxBinsError}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="reorg-min-items" className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                        Items per {t.bin}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="reorg-min-items"
                          type="number"
                          min={1}
                          value={minItemsPerBin}
                          onChange={(e) => setMinItemsPerBin(e.target.value)}
                          placeholder="Min"
                          aria-invalid={!!rangeError}
                        />
                        <Input
                          id="reorg-max-items"
                          type="number"
                          min={1}
                          value={maxItemsPerBin}
                          onChange={(e) => setMaxItemsPerBin(e.target.value)}
                          placeholder="Max"
                          aria-label={`Max items per ${t.bin}`}
                          aria-invalid={!!rangeError}
                        />
                      </div>
                      {rangeError && (
                        <p className="text-[12px] text-[var(--destructive)] mt-1" role="alert">
                          {rangeError}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="reorg-notes" className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">
                        Additional instructions
                      </Label>
                      <Textarea
                        id="reorg-notes"
                        value={userNotes}
                        onChange={(e) => setUserNotes(e.target.value)}
                        placeholder="e.g. Keep kitchen items separate from garage tools"
                        rows={2}
                      />
                    </div>

                    {optionFields.map((field) => (
                      <fieldset key={field.legend} className="border-0 p-0 m-0">
                        <legend className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2 p-0">
                          {field.legend}
                        </legend>
                        <OptionGroup
                          options={field.options}
                          value={field.value}
                          onChange={field.onChange}
                          shape="rounded"
                          size="sm"
                        />
                        {field.hint && (
                          <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
                            {field.hint}
                          </p>
                        )}
                      </fieldset>
                    ))}

                    <div className="text-[12px] text-[var(--text-tertiary)]">
                      {itemCount} item{itemCount !== 1 ? 's' : ''} across selected {t.bins}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div ref={reorgRef} className="lg:sticky lg:top-6 flex flex-col gap-4">
          <Button
            data-tour="reorganize-submit"
            onClick={handleReorganize}
            disabled={!canSubmit}
            className="h-12 text-[17px] rounded-[var(--radius-md)]"
            fullWidth
          >
            <Sparkles className="h-5 w-5 mr-2.5" />
            Reorganize {selection.selectedIds.size} {selection.selectedIds.size === 1 ? t.bin : t.bins}
          </Button>
          {selection.selectedIds.size >= 2 && (
            <p className="text-[12px] text-[var(--text-tertiary)] text-center -mt-2">
              {itemCount} item{itemCount !== 1 ? 's' : ''} across {selection.selectedIds.size} {t.bins}
            </p>
          )}

          {(error || applyError) && (
            <Card className="border-t-2 border-t-[var(--destructive)]">
              <CardContent>
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-[var(--destructive)] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--destructive)]">{error || applyError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clear}
                    className="shrink-0 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -mt-1"
                    aria-label="Dismiss error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2 mt-3 pl-7">
                  <Button variant="outline" size="sm" onClick={handleReorganize} disabled={!canSubmit}>
                    Try again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showProgress && (
            <Card>
              <CardContent>
                <AiProgressBar
                  active={isStreaming}
                  complete={progressComplete}
                  label={isStreaming ? (retryCount > 0 ? `Retrying (attempt ${retryCount + 1} of 3)` : `Reorganizing ${t.bins}`) : 'Complete'}
                />
                {isStreaming && (
                  <div className="flex justify-end mt-3">
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!showProgress && (hasProposal || isStreaming) ? (
            <Card>
              <CardContent>
                <ReorganizePreview
                  result={result}
                  partialResult={partialResult}
                  isStreaming={isStreaming}
                  isApplying={isApplying}
                  originalCount={selection.selectedIds.size}
                  originalItemCount={itemCount}
                  onAccept={() => setConfirmOpen(true)}
                  onCancel={handleCancel}
                  onRegenerate={handleRegenerate}
                />
              </CardContent>
            </Card>
          ) : !showProgress && (
            <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-subtle)]">
              <div className="flex flex-col items-center justify-center py-10 lg:py-16 text-center">
                <div className="rounded-[var(--radius-xl)] bg-[var(--bg-input)] p-3.5 mb-4">
                  <Sparkles className="h-6 w-6 text-[var(--text-tertiary)]" />
                </div>
                <p className="text-[15px] font-medium text-[var(--text-secondary)] mb-1">
                  No proposal yet
                </p>
                <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs px-4">
                  Select at least 2 {t.bins} and click Reorganize to let AI suggest a better organization.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply reorganization?</DialogTitle>
            <DialogDescription>
              This will delete {selection.selectedIds.size} existing {t.bins} and create{' '}
              {result?.bins.length ?? 0} new {t.bins} in their place. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={isApplying}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                handleAccept();
              }}
              disabled={isApplying}
            >
              Delete & recreate {t.bins}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
