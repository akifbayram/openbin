import '@/components/ui/animations.css';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AiSetupDialog } from '@/features/ai/AiSetupDialog';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { resolveIcon } from '@/lib/iconMap';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import { BinDetailSkeleton } from './BinDetailSkeleton';
import { BinDetailToolbar } from './BinDetailToolbar';
import { BinEditContent } from './BinEditContent';
import { BinViewContent } from './BinViewContent';
import { DeleteBinDialog } from './DeleteBinDialog';
import { MoveBinDialog } from './MoveBinDialog';
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
  const [photosExpanded, setPhotosExpanded] = useState(false);
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

  if (isLoading && bin === undefined) {
    return <BinDetailSkeleton />;
  }

  if (!bin) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
        <p className="text-[17px] font-semibold text-[var(--text-secondary)]">{t.Bin} not found</p>
        <Button variant="outline" onClick={() => navigate('/bins')}>
          Back to {t.bins}
        </Button>
      </div>
    );
  }

  const HeaderIcon = resolveIcon(edit.editing ? edit.icon : bin.icon);

  const photosSection = (
    <Card>
      <CardContent className="!py-0">
        <button
          type="button"
          onClick={() => setPhotosExpanded(!photosExpanded)}
          aria-expanded={photosExpanded}
          className="row-spread w-full py-4 text-left"
        >
          <span className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
            Photos{actions.photos.length > 0 ? ` (${actions.photos.length})` : ''}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-200',
              photosExpanded && 'rotate-180'
            )}
          />
        </button>
        {photosExpanded && (
          <div className="pb-4">
            <PhotoGallery binId={bin.id} variant="inline" />
          </div>
        )}
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
        otherLocations={actions.otherLocations}
        onClose={() => guardedNavigate(() => backState?.backPath ? navigate(backState.backPath) : window.history.length > 1 ? navigate(-1) : navigate('/bins'))}
        onPrev={prevBinId ? () => guardedNavigate(() => navigate(`/bin/${prevBinId}`, { state: { ...backState } })) : null}
        onNext={nextBinId ? () => guardedNavigate(() => navigate(`/bin/${nextBinId}`, { state: { ...backState } })) : null}
        hasBinListContext={hasBinListContext}
        onCancelEdit={() => guardedNavigate(() => edit.cancelEdit())}
        onSave={edit.saveEdit}
        onStartEdit={() => edit.startEdit(bin)}
        onAnalyze={actions.handleAnalyzeClick}
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
        onDelete={() => actions.setDeleteOpen(true)}
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

      <DeleteBinDialog
        open={actions.deleteOpen}
        onOpenChange={actions.setDeleteOpen}
        binName={bin.name}
        onConfirm={actions.handleDelete}
      />

      <MoveBinDialog
        open={actions.moveOpen}
        onOpenChange={actions.setMoveOpen}
        binName={bin.name}
        locations={actions.otherLocations}
        onConfirm={actions.handleMove}
      />

      <AiSetupDialog open={actions.aiSetupOpen} onOpenChange={actions.setAiSetupOpen} />

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
