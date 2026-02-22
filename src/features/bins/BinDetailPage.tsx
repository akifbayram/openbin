import '@/features/onboarding/animations.css';
import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Lock, Pencil, Trash2, Printer, Save, Sparkles, Loader2, Check, Pin, Plus, ArrowRightLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/usePermissions';
import { useTerminology } from '@/lib/terminology';
import { useTagColorsContext } from '@/features/tags/TagColorsContext';
import type { Bin, BinVisibility } from '@/types';

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
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAreaId, setEditAreaId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editCardStyle, setEditCardStyle] = useState('');
  const [editVisibility, setEditVisibility] = useState<BinVisibility>('location');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
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
        {/* Title + location skeleton */}
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        {/* Photos card skeleton (collapsed) */}
        <div className="glass-card rounded-[var(--radius-lg)] px-4 py-4">
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Items card skeleton */}
        <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
        </div>
        {/* Notes card skeleton */}
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
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to {t.bins}
        </Button>
      </div>
    );
  }

  function startEdit() {
    if (!bin) return;
    setEditName(bin.name);
    setEditAreaId(bin.area_id);
    setEditItems(bin.items.map((i) => i.name));
    setEditNotes(bin.notes);
    setEditTags([...bin.tags]);
    setEditIcon(bin.icon);
    setEditColor(bin.color);
    setEditCardStyle(bin.card_style);
    setEditVisibility(bin.visibility);
    setEditing(true);
  }

  async function saveEdit() {
    if (!id || !editName.trim()) return;
    await updateBin(id, {
      name: editName.trim(),
      areaId: editAreaId,
      items: editItems,
      notes: editNotes.trim(),
      tags: editTags,
      icon: editIcon,
      color: editColor,
      cardStyle: editCardStyle,
      visibility: editVisibility,
    });
    setEditing(false);
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

  async function handleMove(targetId?: string) {
    const target = targetId ?? moveTargetId;
    if (!id || !target) return;
    const originalLocationId = bin!.location_id;
    const targetLoc = locations.find((l) => l.id === target);
    await moveBin(id, target);
    setMoveOpen(false);
    setMoveTargetId(null);
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
      const newId = await addBin({
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
      navigate(`/bin/${newId}`);
      showToast({ message: `Duplicated "${bin.name}"` });
    } catch {
      showToast({ message: 'Failed to duplicate' });
    }
  }

  const showAiButton = aiEnabled && photos.length > 0 && !editing;
  const canEdit = canEditBin(bin.created_by);
  const canDelete = isAdmin;

  const hasNotes = !!bin.notes;
  const hasTags = bin.tags.length > 0;

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-4 pb-2 max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => backState?.backPath ? navigate(backState.backPath) : window.history.length > 1 ? navigate(-1) : navigate('/bins')}
          className="rounded-[var(--radius-full)] gap-0.5 pl-1.5 pr-3 text-[var(--accent)]"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[15px]">{backLabel}</span>
        </Button>
        <div className="flex-1" />
        {editing ? (
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              className="rounded-[var(--radius-full)]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveEdit}
              disabled={!editName.trim()}
              className="rounded-[var(--radius-full)]"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save
            </Button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            {showAiButton && (
              <Tooltip content="Analyze with AI" side="bottom">
                <Button
                  size="icon"
                  onClick={handleAnalyzeClick}
                  disabled={isAnalyzing}
                  aria-label="Analyze with AI"
                  variant="ghost"
                  className="rounded-full h-9 w-9"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  ) : (
                    <Sparkles className="h-[18px] w-[18px]" />
                  )}
                </Button>
              </Tooltip>
            )}
            <Tooltip content={bin.is_pinned ? 'Unpin' : 'Pin'} side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (bin.is_pinned) {
                    await unpinBin(bin.id);
                    showToast({ message: 'Unpinned' });
                  } else {
                    await pinBin(bin.id);
                    showToast({ message: 'Pinned' });
                  }
                }}
                aria-label={bin.is_pinned ? `Unpin ${t.bin}` : `Pin ${t.bin}`}
                className="rounded-full h-9 w-9"
              >
                <Pin className="h-[18px] w-[18px]" fill={bin.is_pinned ? 'currentColor' : 'none'} />
              </Button>
            </Tooltip>
            {canEdit && (
              <Tooltip content="Edit" side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startEdit}
                  aria-label={`Edit ${t.bin}`}
                  className="rounded-full h-9 w-9"
                >
                  <Pencil className="h-[18px] w-[18px]" />
                </Button>
              </Tooltip>
            )}
            <Tooltip content="Print label" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/print?ids=${id}`)}
                aria-label="Print label"
                className="rounded-full h-9 w-9"
              >
                <Printer className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
            <Tooltip content="Duplicate" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDuplicate}
                aria-label={`Duplicate ${t.bin}`}
                className="rounded-full h-9 w-9"
              >
                <Copy className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
            {isAdmin && otherLocations.length > 0 && (
              <Tooltip content="Move" side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (otherLocations.length === 1) {
                      handleMove(otherLocations[0].id);
                    } else {
                      setMoveTargetId(null);
                      setMoveOpen(true);
                    }
                  }}
                  aria-label={`Move ${t.bin}`}
                  className="rounded-full h-9 w-9"
                >
                  <ArrowRightLeft className="h-[18px] w-[18px]" />
                </Button>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip content="Delete" side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteOpen(true)}
                  aria-label={`Delete ${t.bin}`}
                  className="rounded-full h-9 w-9 text-[var(--destructive)]"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </Button>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="fade-in-fast contents">
          {/* Photos — collapsible, interactive add/delete works in both modes */}
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

          {/* Identity — name, area, visibility */}
          <Card>
            <CardContent className="space-y-5 py-5">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>{t.Area}</Label>
                <AreaPicker locationId={activeLocationId ?? undefined} value={editAreaId} onChange={setEditAreaId} />
              </div>
              {canChangeVisibility(bin.created_by) && (
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <VisibilityPicker value={editVisibility} onChange={setEditVisibility} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent className="space-y-2 py-5">
              <Label>Items</Label>
              <ItemsInput
                items={editItems}
                onChange={setEditItems}
                showAi={aiEnabled}
                aiConfigured={aiEnabled && !!aiSettings}
                onAiSetupNeeded={() => navigate('/settings#ai-settings')}
                binName={editName}
                locationId={activeLocationId ?? undefined}
              />
            </CardContent>
          </Card>

          {/* Appearance — icon, color, style */}
          <Card>
            <CardContent className="space-y-5 py-5">
              <div className="space-y-2">
                <Label>Icon</Label>
                <IconPicker value={editIcon} onChange={setEditIcon} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                {(() => {
                  const sec = getSecondaryColorInfo(editCardStyle);
                  return (
                    <ColorPicker
                      value={editColor}
                      onChange={setEditColor}
                      secondaryLabel={sec?.label}
                      secondaryValue={sec?.value}
                      onSecondaryChange={sec ? (c) => setEditCardStyle(setSecondaryColor(editCardStyle, c)) : undefined}
                    />
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>Style</Label>
                <StylePicker value={editCardStyle} color={editColor} onChange={setEditCardStyle} photos={photos} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="space-y-2 py-5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardContent className="space-y-2 py-5">
              <Label>Tags</Label>
              <TagInput tags={editTags} onChange={setEditTags} suggestions={allTags} />
            </CardContent>
          </Card>

        </div>
      ) : (
        <div className="fade-in-fast contents">
          {/* Title with location subtitle */}
          <div className="flex items-start gap-2.5">
            {(() => { const Icon = resolveIcon(bin.icon); return <Icon className="h-7 w-7 text-[var(--text-secondary)] shrink-0 mt-0.5" />; })()}
            {bin.color && (() => { const preset = resolveColor(bin.color); return preset ? <span className="h-3.5 w-3.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: preset.dot }} /> : null; })()}
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

          {/* Photos card — collapsible */}
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

          {/* Items card — always visible */}
          <Card>
            <CardContent>
              <ItemList items={bin.items} binId={bin.id} readOnly={!canEdit} />
              {/* Quick-add row */}
              {canEdit && <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 transition-all duration-200">
                {quickAdd.state === 'input' && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={quickAdd.value}
                      onChange={(e) => quickAdd.setValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          quickAdd.handleAdd();
                        }
                      }}
                      onPaste={quickAdd.handlePaste}
                      placeholder="Add item..."
                      disabled={quickAdd.saving}
                      className="h-7 bg-transparent px-0.5 py-0 text-base focus-visible:ring-0"
                    />
                    {quickAdd.value.trim() && (
                      <button
                        type="button"
                        onClick={quickAdd.handleAdd}
                        disabled={quickAdd.saving}
                        className="shrink-0 rounded-full p-1 text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors disabled:opacity-50"
                        aria-label="Add item"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    {aiEnabled && (
                      <button
                        type="button"
                        onClick={quickAdd.handleAiClick}
                        className="shrink-0 rounded-full p-1 text-[var(--ai-accent)] hover:bg-[var(--bg-active)] transition-colors"
                        aria-label="AI extract items"
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}

                {(quickAdd.state === 'expanded' || quickAdd.state === 'processing') && (
                  <div className="space-y-2">
                    <textarea
                      value={quickAdd.expandedText}
                      onChange={(e) => quickAdd.setExpandedText(e.target.value)}
                      onKeyDown={quickAdd.handleExpandedKeyDown}
                      placeholder="List or describe items, e.g. 'three socks, AA batteries, winter jacket'"
                      rows={3}
                      disabled={quickAdd.isStructuring}
                      autoFocus
                      className="w-full min-h-[80px] bg-[var(--bg-elevated)] rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none disabled:opacity-50"
                    />
                    {quickAdd.structureError && (
                      <p className="text-[13px] text-[var(--destructive)]">{quickAdd.structureError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={quickAdd.cancelExpanded}
                        className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Cancel
                      </button>
                      <div className="flex-1" />
                      <Button
                        type="button"
                        size="sm"
                        onClick={quickAdd.handleExtractClick}
                        disabled={!quickAdd.expandedText.trim() || quickAdd.isStructuring}
                        className="rounded-[var(--radius-full)] gap-1.5 bg-[var(--ai-accent)] hover:bg-[var(--ai-accent-hover)]"
                      >
                        {quickAdd.isStructuring ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {quickAdd.isStructuring ? 'Extracting...' : 'Extract'}
                      </Button>
                    </div>
                  </div>
                )}

                {quickAdd.state === 'preview' && quickAdd.structuredItems && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {quickAdd.structuredItems.map((item, i) => {
                        const checked = quickAdd.checked.get(i) !== false;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => quickAdd.toggleChecked(i)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition-all ${
                              checked
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] line-through'
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                            {item}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={quickAdd.backToExpanded}
                        className="rounded-[var(--radius-full)] gap-0.5"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <div className="flex-1" />
                      <Button
                        type="button"
                        size="sm"
                        onClick={quickAdd.handleConfirmAdd}
                        disabled={quickAdd.selectedCount === 0}
                        className="rounded-[var(--radius-full)]"
                      >
                        Add {quickAdd.selectedCount}
                      </Button>
                    </div>
                  </div>
                )}
              </div>}
            </CardContent>
          </Card>

          {/* Notes card — only when notes exist */}
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

          {/* Tags card — only when tags exist */}
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

          {/* QR Code & Info — collapsible, collapsed by default */}
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
                    {bin.short_code && (
                      <div className="mb-4">
                        <Label>Short Code</Label>
                        <p className="mt-1.5 text-[15px] font-mono tracking-widest text-[var(--text-primary)]">
                          {bin.short_code}
                        </p>
                      </div>
                    )}
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this {t.bin}?</DialogTitle>
            <DialogDescription>
              This will delete &apos;{bin.name}&apos; and all its photos. You can undo this action briefly after deletion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setDeleteOpen(false);
                handleDelete();
              }}
              className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:bg-[var(--destructive-hover)] text-[var(--text-on-accent)]"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to another {t.location}</DialogTitle>
            <DialogDescription>
              Select a {t.location} to move the &apos;{bin.name}&apos; {t.bin}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            {otherLocations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setMoveTargetId(l.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] text-[15px] transition-colors',
                    moveTargetId === l.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'hover:bg-[var(--bg-active)] text-[var(--text-primary)]'
                  )}
                >
                  {l.name}
                </button>
              ))}
            {otherLocations.length === 0 && (
              <p className="text-[14px] text-[var(--text-tertiary)] text-center py-4">
                No other {t.locations} available
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveOpen(false)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button
              onClick={() => handleMove()}
              disabled={!moveTargetId}
              className="rounded-[var(--radius-full)]"
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
