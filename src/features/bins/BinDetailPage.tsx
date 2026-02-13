import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Pencil, Trash2, Printer, Save, Plus, Sparkles, Loader2, Settings } from 'lucide-react';
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
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { useBin, updateBin, deleteBin, restoreBin, useAllTags } from './useBins';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { resolveIcon } from '@/lib/iconMap';
import { getColorPreset } from '@/lib/colorPalette';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { usePhotos } from '@/features/photos/usePhotos';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { useAiAnalysis } from '@/features/ai/useAiAnalysis';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
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
  const [aiSetupOpen, setAiSetupOpen] = useState(false);

  // AI analysis
  const { photos } = usePhotos(id);
  const { settings: aiSettings } = useAiSettings();
  const { suggestions, isAnalyzing, error: aiError, analyzeMultiple, clearSuggestions } = useAiAnalysis();

  if (isLoading || bin === undefined) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-4 pb-2">
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
    setEditItems([...bin.items]);
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
      await updateBin(id, { items: [...bin.items, value] });
      setQuickAddValue('');
    } catch {
      showToast({ message: 'Failed to add item' });
    } finally {
      setQuickAddSaving(false);
    }
  }

  function handleAnalyzeClick() {
    if (!aiSettings) {
      setAiSetupOpen(true);
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

  const showAiButton = photos.length > 0 && !editing;

  const hasNotes = !!bin.notes;
  const hasTags = bin.tags.length > 0;

  return (
    <div className="flex flex-col gap-4 px-5 pt-4 pb-2 max-w-3xl mx-auto">
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
              <ItemsInput items={editItems} onChange={setEditItems} />
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
              <Label>Items</Label>
              {bin.items.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {bin.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[15px] text-[var(--text-primary)] leading-relaxed">
                      <span className="text-[var(--text-tertiary)] mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[15px] text-[var(--text-tertiary)] italic">No items yet</p>
              )}
              {/* Quick-add row */}
              <div className="flex gap-2 mt-3">
                <Input
                  value={quickAddValue}
                  onChange={(e) => setQuickAddValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAdd();
                    }
                  }}
                  placeholder="Add item..."
                  disabled={quickAddSaving}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleQuickAdd}
                  disabled={!quickAddValue.trim() || quickAddSaving}
                  aria-label="Add item"
                  className="rounded-full h-10 w-10 shrink-0"
                >
                  <Plus className="h-5 w-5" />
                </Button>
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

      {/* AI setup guidance dialog */}
      <Dialog open={aiSetupOpen} onOpenChange={setAiSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up AI Analysis</DialogTitle>
            <DialogDescription>
              AI can analyze your bin photos and suggest names, items, tags, and notes automatically. Connect an AI provider in Settings to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] p-3 space-y-2 text-[13px] text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)]">Supported providers</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />OpenAI (GPT-4o, GPT-4o mini)</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />Anthropic (Claude)</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />Local LLM (OpenAI-compatible)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiSetupOpen(false)} className="rounded-[var(--radius-full)]">
              Later
            </Button>
            <Button
              onClick={() => {
                setAiSetupOpen(false);
                navigate('/settings');
              }}
              className="rounded-[var(--radius-full)]"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              Go to Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
