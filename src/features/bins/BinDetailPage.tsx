import '@/features/onboarding/animations.css';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { TagInput } from './TagInput';
import { ItemsInput } from './ItemsInput';
import { ItemList } from './ItemList';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { StylePicker } from './StylePicker';
import { getSecondaryColorInfo, setSecondaryColor } from '@/lib/cardStyle';
import { useBin, updateBin, deleteBin, restoreBin, useAllTags, moveBin, addBin } from './useBins';
import { VisibilityPicker } from './VisibilityPicker';
import { useQuickAdd } from './useQuickAdd';
import { useLocationList } from '@/features/locations/useLocations';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { resolveIcon } from '@/lib/iconMap';
import { resolveColor } from '@/lib/colorPalette';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { usePhotos } from '@/features/photos/usePhotos';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { useAiAnalysis } from '@/features/ai/useAiAnalysis';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { pinBin, unpinBin } from '@/features/pins/usePins';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/usePermissions';
import { useTerminology } from '@/lib/terminology';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { useTagColorsContext } from '@/features/tags/TagColorsContext';
import { useEditBinForm } from './useEditBinForm';
import { QuickAddWidget } from './QuickAddWidget';
import { BinDetailToolbar } from './BinDetailToolbar';
import { DeleteBinDialog } from './DeleteBinDialog';
import { MoveBinDialog } from './MoveBinDialog';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import type { Bin } from '@/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { bin, isLoading } = useBin(id);
  const allTags = useAllTags();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const { activeLocationId } = useAuth();
  const { isAdmin, canEditBin, canChangeVisibility } = usePermissions();
  const t = useTerminology();
  const backState = location.state as { backLabel?: string; backPath?: string } | null;
  const backLabel = backState?.backLabel || 'Back';
  const { tagColors } = useTagColorsContext();
  const { aiEnabled } = useAiEnabled();
  const edit = useEditBinForm(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const pendingNav = useRef<(() => void) | null>(null);
  const { setGuard } = useNavigationGuard();

  // Register navigation guard with the global context so sidebar/bottom nav are intercepted
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

  const { locations } = useLocationList();
  const otherLocations = locations.filter((l) => l.id !== bin?.location_id);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);

  // AI analysis
  const { photos } = usePhotos(id);
  const { settings: aiSettings } = useAiSettings();
  const { suggestions, isAnalyzing, error: aiError, analyzeMultiple, clearSuggestions } = useAiAnalysis();

  // Quick-add
  const quickAdd = useQuickAdd({
    binId: id,
    binName: bin?.name ?? '',
    existingItems: bin?.items.map((i) => i.name) ?? [],
    activeLocationId: activeLocationId ?? undefined,
    aiConfigured: aiEnabled && !!aiSettings,
    onNavigateAiSetup: () => navigate('/settings#ai-settings'),
  });

  if (isLoading && bin === undefined) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-4 pb-2">
        <Skeleton className="h-8 w-20" />
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="glass-card rounded-[var(--radius-lg)] px-4 py-4">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
        </div>
        <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
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

  async function handleDelete() {
    if (!id || !bin) return;
    const snapshot: Bin = { ...bin };
    await deleteBin(id);
    navigate('/bins');
    showToast({
      message: `Deleted "${snapshot.name}"`,
      action: {
        label: 'Undo',
        onClick: () => restoreBin(snapshot),
      },
    });
  }

  async function handleMove(targetId: string) {
    if (!id) return;
    const originalLocationId = bin!.location_id;
    const targetLoc = locations.find((l) => l.id === targetId);
    await moveBin(id, targetId);
    setMoveOpen(false);
    navigate('/bins');
    showToast({
      message: `Moved to ${targetLoc?.name ?? t.location}`,
      action: {
        label: 'Undo',
        onClick: async () => {
          await moveBin(id, originalLocationId);
        },
      },
    });
  }

  function handleAnalyzeClick() {
    if (!aiSettings) {
      navigate('/settings#ai-settings');
      return;
    }
    if (photos.length > 0) {
      analyzeMultiple(photos.map((p) => p.id));
    }
  }

  async function handleApplySuggestions(changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string }>) {
    if (!id || Object.keys(changes).length === 0) return;
    try {
      await updateBin(id, changes);
      clearSuggestions();
      showToast({ message: 'Applied AI suggestions' });
    } catch {
      showToast({ message: 'Failed to apply suggestions' });
    }
  }

  async function handleDuplicate() {
    if (!bin || !activeLocationId) return;
    try {
      const newBin = await addBin({
        name: `${bin.name} (copy)`,
        locationId: activeLocationId,
        items: bin.items.map((i) => i.name),
        notes: bin.notes,
        tags: [...bin.tags],
        areaId: bin.area_id,
        icon: bin.icon,
        color: bin.color,
        cardStyle: bin.card_style,
        visibility: bin.visibility,
      });
      navigate(`/bin/${newBin.id}`);
      showToast({ message: `Duplicated "${bin.name}"` });
    } catch {
      showToast({ message: 'Failed to duplicate' });
    }
  }

  async function handleTogglePin() {
    if (!bin) return;
    if (bin.is_pinned) {
      await unpinBin(bin.id);
      showToast({ message: 'Unpinned' });
    } else {
      await pinBin(bin.id);
      showToast({ message: 'Pinned' });
    }
  }

  const showAiButton = aiEnabled && photos.length > 0 && !edit.editing;
  const canEdit = canEditBin(bin.created_by);
  const canDelete = isAdmin;
  const hasNotes = !!bin.notes;
  const hasTags = bin.tags.length > 0;

  const ResolvedIcon = resolveIcon(bin.icon);
  const colorPreset = resolveColor(bin.color);
  const secondaryInfo = getSecondaryColorInfo(edit.cardStyle);

  // Photos collapsible — shared between edit and view modes
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
            Photos{photos.length > 0 ? ` (${photos.length})` : ''}
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
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-4 pb-2 max-w-3xl mx-auto">
      <BinDetailToolbar
        bin={bin}
        editing={edit.editing}
        canEdit={canEdit}
        canDelete={canDelete}
        backLabel={backLabel}
        showAiButton={showAiButton}
        isAnalyzing={isAnalyzing}
        editNameValid={!!edit.name.trim()}
        otherLocations={otherLocations}
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
        onAnalyze={handleAnalyzeClick}
        onTogglePin={handleTogglePin}
        onPrint={() => navigate(`/print?ids=${id}`)}
        onDuplicate={handleDuplicate}
        onMove={() => {
          if (otherLocations.length === 1) {
            handleMove(otherLocations[0].id);
          } else {
            setMoveOpen(true);
          }
        }}
        onDelete={() => setDeleteOpen(true)}
      />

      {edit.editing ? (
        <div className="fade-in-fast contents">
          {photosSection}

          {/* Identity — name, area, visibility */}
          <Card>
            <CardContent className="space-y-5 py-5">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={edit.name}
                  onChange={(e) => edit.setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>{t.Area}</Label>
                <AreaPicker locationId={activeLocationId ?? undefined} value={edit.areaId} onChange={edit.setAreaId} />
              </div>
              {canChangeVisibility(bin.created_by) && (
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <VisibilityPicker value={edit.visibility} onChange={edit.setVisibility} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent className="space-y-2 py-5">
              <Label>Items</Label>
              <ItemsInput
                items={edit.items}
                onChange={edit.setItems}
                showAi={aiEnabled}
                aiConfigured={aiEnabled && !!aiSettings}
                onAiSetupNeeded={() => navigate('/settings#ai-settings')}
                binName={edit.name}
                locationId={activeLocationId ?? undefined}
              />
            </CardContent>
          </Card>

          {/* Appearance — icon, color, style */}
          <Card>
            <CardContent className="space-y-5 py-5">
              <div className="space-y-2">
                <Label>Icon</Label>
                <IconPicker value={edit.icon} onChange={edit.setIcon} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <ColorPicker
                  value={edit.color}
                  onChange={edit.setColor}
                  secondaryLabel={secondaryInfo?.label}
                  secondaryValue={secondaryInfo?.value}
                  onSecondaryChange={secondaryInfo ? (c) => edit.setCardStyle(setSecondaryColor(edit.cardStyle, c)) : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>Style</Label>
                <StylePicker value={edit.cardStyle} color={edit.color} onChange={edit.setCardStyle} photos={photos} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="space-y-2 py-5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={edit.notes}
                onChange={(e) => edit.setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardContent className="space-y-2 py-5">
              <Label>Tags</Label>
              <TagInput tags={edit.tags} onChange={edit.setTags} suggestions={allTags} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="fade-in-fast contents">
          {/* Title with location subtitle */}
          <div className="flex items-start gap-2.5">
            <ResolvedIcon className="h-7 w-7 text-[var(--text-secondary)] shrink-0 mt-0.5" />
            {colorPreset && <span className="h-3.5 w-3.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: colorPreset.dot }} />}
            <div className="min-w-0">
              <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-tight flex items-center gap-2">
                {bin.name}
                {bin.visibility === 'private' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-tertiary)]">
                    <Lock className="h-3 w-3" />
                    Private
                  </span>
                )}
              </h1>
              {bin.area_name && (
                <p className="text-[15px] text-[var(--text-secondary)] mt-0.5 truncate">
                  {bin.area_name}
                </p>
              )}
            </div>
          </div>

          {/* AI error */}
          {aiError && (
            <Card className="border-t-2 border-t-[var(--destructive)]">
              <CardContent>
                <p className="text-[14px] text-[var(--destructive)]">{aiError}</p>
                <Button variant="ghost" size="sm" onClick={clearSuggestions} className="mt-2 rounded-[var(--radius-full)]">
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          )}

          {/* AI suggestions */}
          {suggestions && (
            <AiSuggestionsPanel
              suggestions={suggestions}
              currentName={bin.name}
              currentItems={bin.items}
              currentTags={bin.tags}
              currentNotes={bin.notes}
              onApply={handleApplySuggestions}
              onDismiss={clearSuggestions}
            />
          )}

          {photosSection}

          {/* Items card */}
          <Card>
            <CardContent>
              <ItemList items={bin.items} binId={bin.id} readOnly={!canEdit} />
              {canEdit && <QuickAddWidget quickAdd={quickAdd} aiEnabled={aiEnabled} />}
            </CardContent>
          </Card>

          {/* Notes card */}
          {hasNotes && (
            <Card>
              <CardContent>
                <Label>Notes</Label>
                <p className="mt-2 text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                  {bin.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tags card */}
          {hasTags && (
            <Card>
              <CardContent>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {bin.tags.map((tag) => {
                    const tagColorKey = tagColors.get(tag);
                    const tagPreset = tagColorKey ? resolveColor(tagColorKey) : undefined;
                    const tagStyle = tagPreset
                      ? {
                          backgroundColor: tagPreset.bgCss,
                          color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)',
                        }
                      : undefined;
                    return (
                      <Badge key={tag} variant="secondary" style={tagStyle}>{tag}</Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* QR Code & Info */}
          <Card>
            <CardContent className="!py-0">
              <button
                type="button"
                onClick={() => setQrExpanded(!qrExpanded)}
                aria-expanded={qrExpanded}
                className="flex items-center justify-between w-full py-4 text-left"
              >
                <span className="text-[13px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  QR Code & Info
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-200',
                    qrExpanded && 'rotate-180'
                  )}
                />
              </button>
              {qrExpanded && (
                <div className="pb-4 space-y-4">
                  <div className="flex flex-col items-center">
                    <QRCodeDisplay binId={bin.id} size={160} />
                  </div>
                  <div className="border-t border-[var(--border-subtle)] pt-4">
                    <div className="mb-4">
                      <Label>Code</Label>
                      <p className="mt-1.5 text-[15px] font-mono tracking-widest text-[var(--text-primary)]">
                        {bin.id}
                      </p>
                    </div>
                    {bin.created_by_name && (
                      <div className="mb-4">
                        <Label>Created by</Label>
                        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                          {bin.created_by_name}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <Label>Created</Label>
                        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                          {formatDate(bin.created_at)}
                        </p>
                      </div>
                      <div>
                        <Label>Updated</Label>
                        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                          {formatDate(bin.updated_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <DeleteBinDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        binName={bin.name}
        onConfirm={handleDelete}
      />

      <MoveBinDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        binName={bin.name}
        locations={otherLocations}
        onConfirm={handleMove}
      />

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
