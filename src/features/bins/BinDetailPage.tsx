import '@/features/onboarding/animations.css';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBin, useAllTags } from './useBins';
import { resolveIcon } from '@/lib/iconMap';
import { resolveColor } from '@/lib/colorPalette';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { useEditBinForm } from './useEditBinForm';
import { BinDetailToolbar } from './BinDetailToolbar';
import { BinDetailSkeleton } from './BinDetailSkeleton';
import { BinEditContent } from './BinEditContent';
import { BinViewContent } from './BinViewContent';
import { useBinDetailActions } from './useBinDetailActions';
import { AiSetupDialog } from '@/features/ai/AiSetupDialog';
import { DeleteBinDialog } from './DeleteBinDialog';
import { MoveBinDialog } from './MoveBinDialog';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

export function BinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { bin, isLoading } = useBin(id);
  const allTags = useAllTags();
  const t = useTerminology();
  const backState = location.state as { backLabel?: string; backPath?: string } | null;
  const backLabel = backState?.backLabel || 'Back';
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
  const headerColorPreset = resolveColor(edit.editing ? edit.color : bin.color);

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
        backLabel={backLabel}
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

      {/* Unified header — stable across edit/view modes */}
      <div className="flex items-start gap-2.5">
        <HeaderIcon className="h-7 w-7 text-[var(--text-secondary)] shrink-0 mt-0.5" />
        {headerColorPreset && (
          <span
            className="h-3.5 w-3.5 rounded-full shrink-0 mt-2"
            style={{ backgroundColor: headerColorPreset.dot }}
          />
        )}
        <div className="min-w-0 flex-1">
          {edit.editing ? (
            <input
              id="edit-name"
              value={edit.name}
              onChange={(e) => edit.setName(e.target.value)}
              className="w-full bg-transparent text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-tight border-b-2 border-b-transparent outline-none placeholder:text-[var(--text-tertiary)] p-0"
              placeholder="Name..."
            />
          ) : (
            <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-tight flex items-center gap-2 border-b-2 border-b-transparent">
              {bin.name}
              {bin.visibility === 'private' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-input)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-tertiary)]">
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              )}
            </h1>
          )}

          {!edit.editing && bin.area_name && (
            <p className="text-[15px] text-[var(--text-secondary)] mt-0.5 truncate">
              {bin.area_name}
            </p>
          )}
        </div>
      </div>

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
