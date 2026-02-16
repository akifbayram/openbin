import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Pencil, Trash2, Printer, Save, Sparkles, Loader2, Check, Pin, Plus } from 'lucide-react';
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
import { useBin, updateBin, deleteBin, restoreBin, useAllTags, addItemsToBin } from './useBins';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { resolveIcon } from '@/lib/iconMap';
import { getColorPreset } from '@/lib/colorPalette';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { usePhotos } from '@/features/photos/usePhotos';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { useAiAnalysis } from '@/features/ai/useAiAnalysis';
import { useTextStructuring } from '@/features/ai/useTextStructuring';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { pinBin, unpinBin } from '@/features/pins/usePins';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { useTagColorsContext } from '@/features/tags/TagColorsContext';
import type { Bin } from '@/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { bin, isLoading } = useBin(id);
  const allTags = useAllTags();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const { activeLocationId } = useAuth();
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [quickAddState, setQuickAddState] = useState<'input' | 'expanded' | 'processing' | 'preview'>('input');
  const [quickAddExpandedText, setQuickAddExpandedText] = useState('');
  const [quickAddChecked, setQuickAddChecked] = useState<Map<number, boolean>>(new Map());

  // AI analysis
  const { photos } = usePhotos(id);
  const { settings: aiSettings } = useAiSettings();
  const { suggestions, isAnalyzing, error: aiError, analyzeMultiple, clearSuggestions } = useAiAnalysis();
  const { structuredItems: quickAddStructured, isStructuring: quickAddStructuring, error: quickAddError, structure: quickAddStructure, clearStructured: quickAddClearStructured } = useTextStructuring();

  if (isLoading || bin === undefined) {
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

  if (bin === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
        <p className="text-[17px] font-semibold text-[var(--text-secondary)]">Bin not found</p>
        <Button variant="outline" onClick={() => navigate('/bins')} className="rounded-[var(--radius-full)]">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to bins
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

  async function handleQuickAdd() {
    const value = quickAddValue.trim();
    if (!value || !id || !bin) return;
    setQuickAddSaving(true);
    try {
      // Comma-separated entry: split if commas present
      if (value.includes(',')) {
        const newItems = value.split(',').map((s) => s.trim()).filter(Boolean);
        if (newItems.length > 0) {
          await addItemsToBin(id, newItems);
          showToast({ message: `Added ${newItems.length} items` });
        }
      } else {
        await addItemsToBin(id, [value]);
      }
      setQuickAddValue('');
    } catch {
      showToast({ message: 'Failed to add item' });
    } finally {
      setQuickAddSaving(false);
    }
  }

  async function handleQuickAddPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') || !id || !bin) return;
    e.preventDefault();
    const newItems = text.split('\n').map((s) => s.trim()).filter(Boolean);
    if (newItems.length === 0) return;
    setQuickAddSaving(true);
    try {
      await addItemsToBin(id, newItems);
      showToast({ message: `Added ${newItems.length} items` });
      setQuickAddValue('');
    } catch {
      showToast({ message: 'Failed to add items' });
    } finally {
      setQuickAddSaving(false);
    }
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

  const showAiButton = aiEnabled && photos.length > 0 && !editing;

  const hasNotes = !!bin.notes;
  const hasTags = bin.tags.length > 0;

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-4 pb-2 max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/bins')}
          className="rounded-[var(--radius-full)] gap-0.5 pl-1.5 pr-3 text-[var(--accent)]"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[15px]">Bins</span>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAnalyzeClick}
                disabled={isAnalyzing}
                aria-label="Analyze with AI"
                className="rounded-full h-9 w-9"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <Sparkles className="h-[18px] w-[18px]" />
                )}
              </Button>
            )}
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
              aria-label={bin.is_pinned ? 'Unpin bin' : 'Pin bin'}
              className="rounded-full h-9 w-9"
            >
              <Pin className="h-[18px] w-[18px]" fill={bin.is_pinned ? 'currentColor' : 'none'} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={startEdit}
              aria-label="Edit bin"
              className="rounded-full h-9 w-9"
            >
              <Pencil className="h-[18px] w-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/print?ids=${id}`)}
              aria-label="Print label"
              className="rounded-full h-9 w-9"
            >
              <Printer className="h-[18px] w-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete bin"
              className="rounded-full h-9 w-9 text-[var(--destructive)]"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <>
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

          {/* Identity — name, area, icon, color */}
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
                <Label>Area</Label>
                <AreaPicker locationId={activeLocationId ?? undefined} value={editAreaId} onChange={setEditAreaId} />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <IconPicker value={editIcon} onChange={setEditIcon} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <ColorPicker value={editColor} onChange={setEditColor} />
              </div>
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

        </>
      ) : (
        <>
          {/* Title with location subtitle */}
          <div className="flex items-start gap-2.5">
            {(() => { const Icon = resolveIcon(bin.icon); return <Icon className="h-7 w-7 text-[var(--text-secondary)] shrink-0 mt-0.5" />; })()}
            {bin.color && (() => { const preset = getColorPreset(bin.color); return preset ? <span className="h-3.5 w-3.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: preset.dot }} /> : null; })()}
            <div className="min-w-0">
              <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-tight">
                {bin.name}
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
              <ItemList items={bin.items} binId={bin.id} />
              {/* Quick-add row */}
              <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 transition-all duration-200">
                {quickAddState === 'input' && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={quickAddValue}
                      onChange={(e) => setQuickAddValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAdd();
                        }
                      }}
                      onPaste={handleQuickAddPaste}
                      placeholder="Add item..."
                      disabled={quickAddSaving}
                      className="h-7 bg-transparent p-0 text-base focus-visible:ring-0"
                    />
                    {quickAddValue.trim() && (
                      <button
                        type="button"
                        onClick={handleQuickAdd}
                        disabled={quickAddSaving}
                        className="shrink-0 rounded-full p-1 text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors disabled:opacity-50"
                        aria-label="Add item"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    {aiEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!aiSettings) {
                            navigate('/settings#ai-settings');
                            return;
                          }
                          quickAddClearStructured();
                          if (quickAddValue.trim()) {
                            const text = quickAddValue.trim();
                            setQuickAddExpandedText(text);
                            setQuickAddValue('');
                            setQuickAddState('processing');
                            quickAddStructure({
                              text,
                              mode: 'items',
                              context: { binName: bin.name, existingItems: bin.items.map((i) => i.name) },
                              locationId: activeLocationId ?? undefined,
                            }).then((items) => {
                              if (items) {
                                const initial = new Map<number, boolean>();
                                items.forEach((_, i) => initial.set(i, true));
                                setQuickAddChecked(initial);
                                setQuickAddState('preview');
                              } else {
                                setQuickAddState('expanded');
                              }
                            });
                          } else {
                            setQuickAddExpandedText('');
                            setQuickAddState('expanded');
                          }
                        }}
                        className="shrink-0 rounded-full p-1 text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
                        aria-label="AI extract items"
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}

                {(quickAddState === 'expanded' || quickAddState === 'processing') && (
                  <div className="space-y-2">
                    <textarea
                      value={quickAddExpandedText}
                      onChange={(e) => setQuickAddExpandedText(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault();
                          if (!quickAddExpandedText.trim() || quickAddStructuring) return;
                          setQuickAddState('processing');
                          quickAddStructure({
                            text: quickAddExpandedText.trim(),
                            mode: 'items',
                            context: { binName: bin.name, existingItems: bin.items.map((i) => i.name) },
                            locationId: activeLocationId ?? undefined,
                          }).then((items) => {
                            if (items) {
                              const initial = new Map<number, boolean>();
                              items.forEach((_, i) => initial.set(i, true));
                              setQuickAddChecked(initial);
                              setQuickAddState('preview');
                            } else {
                              setQuickAddState('expanded');
                            }
                          });
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setQuickAddState('input');
                          setQuickAddExpandedText('');
                          quickAddClearStructured();
                        }
                      }}
                      placeholder="List or describe items, e.g. 'three socks, AA batteries, winter jacket'"
                      rows={3}
                      disabled={quickAddStructuring}
                      autoFocus
                      className="w-full min-h-[80px] bg-[var(--bg-elevated)] rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none disabled:opacity-50"
                    />
                    {quickAddError && (
                      <p className="text-[13px] text-[var(--destructive)]">{quickAddError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAddState('input');
                          setQuickAddExpandedText('');
                          quickAddClearStructured();
                        }}
                        className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Cancel
                      </button>
                      <div className="flex-1" />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (!quickAddExpandedText.trim() || quickAddStructuring) return;
                          setQuickAddState('processing');
                          quickAddStructure({
                            text: quickAddExpandedText.trim(),
                            mode: 'items',
                            context: { binName: bin.name, existingItems: bin.items.map((i) => i.name) },
                            locationId: activeLocationId ?? undefined,
                          }).then((items) => {
                            if (items) {
                              const initial = new Map<number, boolean>();
                              items.forEach((_, i) => initial.set(i, true));
                              setQuickAddChecked(initial);
                              setQuickAddState('preview');
                            } else {
                              setQuickAddState('expanded');
                            }
                          });
                        }}
                        disabled={!quickAddExpandedText.trim() || quickAddStructuring}
                        className="rounded-[var(--radius-full)] gap-1.5"
                      >
                        {quickAddStructuring ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {quickAddStructuring ? 'Extracting...' : 'Extract'}
                      </Button>
                    </div>
                  </div>
                )}

                {quickAddState === 'preview' && quickAddStructured && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {quickAddStructured.map((item, i) => {
                        const checked = quickAddChecked.get(i) !== false;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setQuickAddChecked((prev) => {
                                const next = new Map(prev);
                                next.set(i, !(prev.get(i) ?? true));
                                return next;
                              });
                            }}
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
                        onClick={() => {
                          quickAddClearStructured();
                          setQuickAddChecked(new Map());
                          setQuickAddState('expanded');
                        }}
                        className="rounded-[var(--radius-full)] gap-0.5"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <div className="flex-1" />
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          if (!quickAddStructured || !id || !bin) return;
                          const selected = quickAddStructured.filter((_, i) => quickAddChecked.get(i) !== false);
                          if (selected.length === 0) return;
                          try {
                            await addItemsToBin(id, selected);
                            showToast({ message: `Added ${selected.length} item${selected.length !== 1 ? 's' : ''}` });
                          } catch {
                            showToast({ message: 'Failed to add items' });
                          }
                          setQuickAddState('input');
                          setQuickAddExpandedText('');
                          quickAddClearStructured();
                          setQuickAddChecked(new Map());
                        }}
                        disabled={quickAddStructured.filter((_, i) => quickAddChecked.get(i) !== false).length === 0}
                        className="rounded-[var(--radius-full)]"
                      >
                        Add {quickAddStructured.filter((_, i) => quickAddChecked.get(i) !== false).length}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
                    const tagPreset = tagColorKey ? getColorPreset(tagColorKey) : undefined;
                    const tagStyle = tagPreset
                      ? {
                          backgroundColor: theme === 'dark' ? tagPreset.bgDark : tagPreset.bg,
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
        </>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this bin?</DialogTitle>
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

    </div>
  );
}
