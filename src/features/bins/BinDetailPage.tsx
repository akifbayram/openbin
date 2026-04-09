import { PackageOpen } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { LabelThreshold } from '@/components/ui/ai-progress-bar';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { EmptyState } from '@/components/ui/empty-state';
import { AiSetupDialog } from '@/features/ai/AiSetupDialog';
import { useCheckouts } from '@/features/checkouts/useCheckouts';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { resolveIcon } from '@/lib/iconMap';
import { useTerminology } from '@/lib/terminology';
import { usePlan } from '@/lib/usePlan';
import { disclosureSectionLabel } from '@/lib/utils';
import { BinDetailContent } from './BinDetailContent';
import { BinDetailSkeleton } from './BinDetailSkeleton';
import { BinDetailToolbar } from './BinDetailToolbar';
import { ChangeCodeDialog } from './ChangeCodeDialog';
import { MoveBinDialog } from './MoveBinDialog';
import { ShareBinDialog } from './ShareBinDialog';
import { useAutoSaveBin } from './useAutoSaveBin';
import { useBinDetailActions } from './useBinDetailActions';
import type { BinFilters, SortOption } from './useBins';
import { useAllTags, useBin, useBinList } from './useBins';
import { useCustomFields } from './useCustomFields';

const UpgradeDialog = __EE__
  ? lazy(() => import('@/ee/UpgradeDialog').then(m => ({ default: m.UpgradeDialog })))
  : (() => null) as React.FC<Record<string, unknown>>;

interface BinDetailLocationState {
  backPath?: string;
  backLabel?: string;
  searchQuery?: string;
  sort?: SortOption;
  filters?: BinFilters;
}

export function BinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { bin, isLoading } = useBin(id);
  const { checkouts } = useCheckouts(id);
  const allTags = useAllTags();
  const t = useTerminology();
  const backState = location.state as BinDetailLocationState | null;
  const actions = useBinDetailActions(bin, id);
  const autoSave = useAutoSaveBin(bin ?? null);
  const { fields: customFieldDefs } = useCustomFields(bin?.location_id);
  const { isLocked } = usePlan();
  const [shareOpen, setShareOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const showShareButton = actions.isAdmin && !isLocked;

  // Fetch the bin list matching the sort/search/filters the user had active
  const hasBinListContext = !!backState?.backPath;
  const { bins: binList, isLoading: binListLoading } = useBinList(
    backState?.searchQuery,
    backState?.sort,
    backState?.filters,
    !hasBinListContext,
  );

  // Derive prev/next bin IDs
  const currentIndex = hasBinListContext && !binListLoading ? binList.findIndex((b) => b.id === id) : -1;
  const prevBinId = currentIndex > 0 ? binList[currentIndex - 1].id : null;
  const nextBinId = currentIndex >= 0 && currentIndex < binList.length - 1 ? binList[currentIndex + 1].id : null;

  // Keyboard shortcuts — prev/next only (no edit mode shortcuts)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.key === 'j' || e.key === 'ArrowLeft') && prevBinId) {
        e.preventDefault();
        navigate(`/bin/${prevBinId}`, { state: { ...backState } });
      }
      if ((e.key === 'k' || e.key === 'ArrowRight') && nextBinId) {
        e.preventDefault();
        navigate(`/bin/${nextBinId}`, { state: { ...backState } });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevBinId, nextBinId, navigate, backState]);

  if (isLoading && bin === undefined) {
    return <BinDetailSkeleton />;
  }

  if (!bin) {
    return (
      <EmptyState icon={PackageOpen} title={`${t.Bin} not found`} subtitle="It may have been deleted or moved to another location.">
        <Button variant="outline" onClick={() => navigate('/bins')}>
          Back to {t.bins}
        </Button>
      </EmptyState>
    );
  }

  const HeaderIcon = resolveIcon(bin.icon);

  const photosSection = (
    <Card>
      <CardContent className="!py-0">
        <Disclosure
          label={`Photos${actions.photos.length > 0 ? ` (${actions.photos.length})` : ''}`}
          labelClassName={disclosureSectionLabel}
        >
          <div className="pb-2">
            <PhotoGallery binId={bin.id} variant="inline" />
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  );

  function handleClose() {
    if (backState?.backPath) navigate(backState.backPath);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/bins');
  }

  const detailLabels: LabelThreshold[] = actions.isReanalysis
    ? [[0, 'Preparing reanalysis...'], [15, 'Comparing changes...'], [45, 'Updating suggestions...'], [75, 'Almost done...']]
    : [[0, 'Uploading photos...'], [15, 'Identifying items...'], [45, 'Generating details...'], [75, 'Almost done...']];

  return (
    <div className="page-content max-w-5xl">
      <BinDetailToolbar
        bin={bin}
        canEdit={actions.canEdit}
        canPin={actions.canPin}
        canDelete={actions.canDelete}
        binIcon={HeaderIcon}
        showAiButton={actions.showAiButton}
        isAnalyzing={actions.isAnalyzing}
        isReanalysis={actions.isReanalysis}
        otherLocations={actions.otherLocations}
        onClose={handleClose}
        onPrev={prevBinId ? () => navigate(`/bin/${prevBinId}`, { state: { ...backState } }) : null}
        onNext={nextBinId ? () => navigate(`/bin/${nextBinId}`, { state: { ...backState } }) : null}
        hasBinListContext={hasBinListContext}
        onAnalyze={actions.aiGated ? () => setUpgradeOpen(true) : actions.handleAnalyzeClick}
        onTogglePin={actions.handleTogglePin}
        onPrint={() => navigate(`/print?ids=${id}`)}
        onDuplicate={actions.handleDuplicate}
        onMove={() => {
          if (actions.otherLocations.length === 1) {
            actions.handleMove(actions.otherLocations[0].id);
          } else {
            actions.setMoveOpen(true);
          }
        }}
        onDelete={actions.handleDelete}
        isAdmin={actions.isAdmin}
        onChangeCode={() => actions.setChangeCodeOpen(true)}
        onShare={() => setShareOpen(true)}
        showShareButton={showShareButton}
        onSaveName={autoSave.saveName}
        nameSaved={autoSave.savedFields.has('name')}
      />

      {actions.isAnalyzing && (
        <AiProgressBar
          compact
          active
          labels={detailLabels}
          className="mt-2 mb-1"
        />
      )}

      <BinDetailContent
        bin={bin}
        autoSave={autoSave}
        photosSection={photosSection}
        canEdit={actions.canEdit}
        canChangeVisibility={actions.canChangeVisibility(bin.created_by)}
        quickAdd={actions.quickAdd}
        allTags={allTags}
        aiEnabled={actions.aiEnabled}
        aiGated={actions.aiGated}
        onUpgrade={() => setUpgradeOpen(true)}
        aiError={actions.aiError}
        suggestions={actions.suggestions}
        previousResult={actions.lastSuggestions}
        customFields={customFieldDefs}
        photos={actions.photos}
        activeLocationId={actions.activeLocationId ?? undefined}
        checkouts={checkouts}
        onApplySuggestions={actions.handleApplySuggestions}
        onClearSuggestions={actions.clearSuggestions}
      />

      <MoveBinDialog
        open={actions.moveOpen}
        onOpenChange={actions.setMoveOpen}
        binName={bin.name}
        locations={actions.otherLocations}
        onConfirm={actions.handleMove}
      />

      <AiSetupDialog open={actions.aiSetupOpen} onOpenChange={actions.setAiSetupOpen} />

      {__EE__ && (
        <Suspense fallback={null}>
          <UpgradeDialog
            open={upgradeOpen}
            onOpenChange={setUpgradeOpen}
            feature="AI Features"
            description="AI-powered analysis and suggestions are available on the Pro plan."
          />
        </Suspense>
      )}

      <ChangeCodeDialog
        open={actions.changeCodeOpen}
        onOpenChange={actions.setChangeCodeOpen}
        currentBin={{ id: bin.id, short_code: bin.short_code, name: bin.name }}
      />

      {showShareButton && (
        <ShareBinDialog
          binId={bin.id}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
    </div>
  );
}
