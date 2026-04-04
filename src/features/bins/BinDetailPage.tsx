import { PackageOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { EmptyState } from '@/components/ui/empty-state';
import { UpgradeDialog } from '@/components/ui/upgrade-dialog';
import { AiSetupDialog } from '@/features/ai/AiSetupDialog';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { resolveIcon } from '@/lib/iconMap';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { useTerminology } from '@/lib/terminology';
import { usePlan } from '@/lib/usePlan';
import { disclosureSectionLabel } from '@/lib/utils';
import { BinDetailSkeleton } from './BinDetailSkeleton';
import { BinDetailToolbar } from './BinDetailToolbar';
import { BinEditContent } from './BinEditContent';
import { BinViewContent } from './BinViewContent';
import { ChangeCodeDialog } from './ChangeCodeDialog';
import { MoveBinDialog } from './MoveBinDialog';
import { ShareBinDialog } from './ShareBinDialog';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { useBinDetailActions } from './useBinDetailActions';
import type { BinFilters, SortOption } from './useBins';
import { useAllTags, useBin, useBinList } from './useBins';
import { useCustomFields } from './useCustomFields';
import { useEditBinForm } from './useEditBinForm';

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
  const allTags = useAllTags();
  const t = useTerminology();
  const backState = location.state as BinDetailLocationState | null;
  const edit = useEditBinForm(id);
  const actions = useBinDetailActions(bin, id, edit.editing);
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

  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const pendingNav = useRef<(() => void) | null>(null);
  const { setGuard, guardedNavigate } = useNavigationGuard();

  // Register navigation guard so sidebar/bottom nav are intercepted
  useEffect(() => {
    if (!edit.editing || !edit.isDirty) {
      setGuard(null);
      return;
    }
    setGuard({
      shouldBlock: () => true,
      onBlocked: (proceed) => {
        pendingNav.current = proceed;
        setUnsavedOpen(true);
      },
    });
    return () => setGuard(null);
  }, [edit.editing, edit.isDirty, setGuard]);

  // Block browser back/forward via popstate when dirty
  useEffect(() => {
    if (!edit.editing || !edit.isDirty) return;
    window.history.pushState(null, '', window.location.href);
    function handlePopState() {
      window.history.pushState(null, '', window.location.href);
      pendingNav.current = () => window.history.go(-2);
      setUnsavedOpen(true);
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [edit.editing, edit.isDirty]);

  // Keyboard shortcuts — use ref for unstable `edit` object to avoid re-registering listener every render
  const editRef = useRef(edit);
  editRef.current = edit;
  // biome-ignore lint/correctness/useExhaustiveDependencies: edit.editing intentionally triggers re-registration of shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const ed = editRef.current;

      if (ed.editing) {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault();
          ed.saveEdit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          guardedNavigate(() => ed.cancelEdit());
        }
      } else if (bin) {
        if (e.key === 'e' && actions.canEdit) {
          e.preventDefault();
          ed.startEdit(bin);
        }
        if ((e.key === 'j' || e.key === 'ArrowLeft') && prevBinId) {
          e.preventDefault();
          navigate(`/bin/${prevBinId}`, { state: { ...backState } });
        }
        if ((e.key === 'k' || e.key === 'ArrowRight') && nextBinId) {
          e.preventDefault();
          navigate(`/bin/${nextBinId}`, { state: { ...backState } });
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [edit.editing, actions.canEdit, bin, prevBinId, nextBinId, navigate, backState, guardedNavigate]);

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

  const HeaderIcon = resolveIcon(edit.editing ? edit.icon : bin.icon);

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

  return (
    <div className="page-content">
      <BinDetailToolbar
        bin={bin}
        editing={edit.editing}
        canEdit={actions.canEdit}
        canPin={actions.canPin}
        canDelete={actions.canDelete}
        binIcon={HeaderIcon}
        editingName={edit.name}
        onNameChange={edit.setName}
        showAiButton={actions.showAiButton}
        isAnalyzing={actions.isAnalyzing}
        isReanalysis={actions.isReanalysis}
        editNameValid={!!edit.name.trim()}
        isSaving={edit.isSaving}
        otherLocations={actions.otherLocations}
        onClose={() => guardedNavigate(() => backState?.backPath ? navigate(backState.backPath) : window.history.length > 1 ? navigate(-1) : navigate('/bins'))}
        onPrev={prevBinId ? () => guardedNavigate(() => navigate(`/bin/${prevBinId}`, { state: { ...backState } })) : null}
        onNext={nextBinId ? () => guardedNavigate(() => navigate(`/bin/${nextBinId}`, { state: { ...backState } })) : null}
        hasBinListContext={hasBinListContext}
        onCancelEdit={() => guardedNavigate(() => edit.cancelEdit())}
        onSave={edit.saveEdit}
        onStartEdit={() => edit.startEdit(bin)}
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
      />

      {edit.editing ? (
        <BinEditContent
          edit={edit}
          photosSection={photosSection}
          photos={actions.photos}
          allTags={allTags}
          aiEnabled={actions.aiEnabled}
          aiConfigured={actions.aiEnabled && !!actions.aiSettings}
          activeLocationId={actions.activeLocationId ?? undefined}
          canChangeVisibility={actions.canChangeVisibility(bin.created_by)}
          customFields={customFieldDefs}
          onAiSetupNeeded={() => actions.setAiSetupOpen(true)}
        />
      ) : (
        <BinViewContent
          bin={bin}
          photosSection={photosSection}
          canEdit={actions.canEdit}
          quickAdd={actions.quickAdd}
          aiEnabled={actions.aiEnabled}
          aiGated={actions.aiGated}
          onUpgrade={() => setUpgradeOpen(true)}
          aiError={actions.aiError}
          suggestions={actions.suggestions}
          previousResult={actions.lastSuggestions}
          hasNotes={actions.hasNotes}
          hasTags={actions.hasTags}
          customFields={customFieldDefs}
          onApplySuggestions={actions.handleApplySuggestions}
          onClearSuggestions={actions.clearSuggestions}
        />
      )}

      <MoveBinDialog
        open={actions.moveOpen}
        onOpenChange={actions.setMoveOpen}
        binName={bin.name}
        locations={actions.otherLocations}
        onConfirm={actions.handleMove}
      />

      <AiSetupDialog open={actions.aiSetupOpen} onOpenChange={actions.setAiSetupOpen} />

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="AI Features"
        description="AI-powered analysis and suggestions are available on the Pro plan."
      />

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

      <UnsavedChangesDialog
        open={unsavedOpen}
        onSave={async () => {
          await edit.saveEdit();
          setUnsavedOpen(false);
          pendingNav.current?.();
          pendingNav.current = null;
        }}
        onDiscard={() => {
          edit.cancelEdit();
          setUnsavedOpen(false);
          pendingNav.current?.();
          pendingNav.current = null;
        }}
        onCancel={() => {
          setUnsavedOpen(false);
          pendingNav.current = null;
        }}
      />
    </div>
  );
}
