import '@/features/onboarding/animations.css';
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
import { useAllTags, useBin } from './useBins';
import { useEditBinForm } from './useEditBinForm';

export function BinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { bin, isLoading } = useBin(id);
  const allTags = useAllTags();
  const t = useTerminology();
  const backState = location.state as { backPath?: string } | null;
  const edit = useEditBinForm(id);
  const actions = useBinDetailActions(bin, id, edit.editing);

  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const pendingNav = useRef<(() => void) | null>(null);
  const { setGuard } = useNavigationGuard();

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
        <Button variant="outline" onClick={() => navigate('/bins')} className="rounded-[var(--radius-full)]">
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
          className="flex items-center justify-between w-full py-4 text-left"
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
          <div className="pb-4 animate-fade-in-up">
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
        canDelete={actions.canDelete}
        binIcon={HeaderIcon}
        editingName={edit.name}
        onNameChange={edit.setName}
        showAiButton={actions.showAiButton}
        isAnalyzing={actions.isAnalyzing}
        editNameValid={!!edit.name.trim()}
        otherLocations={actions.otherLocations}
        onBack={() => {
          const doNav = () => backState?.backPath ? navigate(backState.backPath) : window.history.length > 1 ? navigate(-1) : navigate('/bins');
          if (edit.editing && edit.isDirty) {
            pendingNav.current = doNav;
            setUnsavedOpen(true);
          } else {
            doNav();
          }
        }}
        onCancelEdit={() => {
          if (edit.isDirty) {
            pendingNav.current = () => edit.cancelEdit();
            setUnsavedOpen(true);
          } else {
            edit.cancelEdit();
          }
        }}
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
          hasNotes={actions.hasNotes}
          hasTags={actions.hasTags}
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
