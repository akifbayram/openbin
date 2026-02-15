import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Sparkles, X, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TagInput } from './TagInput';
import { ItemsInput } from './ItemsInput';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { addBin, useAllTags } from './useBins';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAuth } from '@/lib/auth';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { analyzeImageFiles, MAX_AI_PHOTOS } from '@/features/ai/useAiAnalysis';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { compressImage } from '@/features/photos/compressImage';
import { addPhoto } from '@/features/photos/usePhotos';
import type { AiSuggestions } from '@/types';

interface BinCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillName?: string;
}

export function BinCreateDialog({ open, onOpenChange, prefillName }: BinCreateDialogProps) {
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const allTags = useAllTags();
  const { settings: aiSettings } = useAiSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(prefillName ?? '');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(false);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestions | null>(null);
  const [aiSetupOpen, setAiSetupOpen] = useState(false);

  // Revoke ObjectURLs on cleanup
  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  // Scroll suggestions into view when they appear
  useEffect(() => {
    if (suggestions && suggestionsRef.current) {
      suggestionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [suggestions]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  function resetForm() {
    setName(prefillName ?? '');
    setAreaId(null);
    setItems([]);
    setNotes('');
    setTags([]);
    setIcon('');
    setColor('');
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotos([]);
    setPhotoPreviews([]);
    setAnalyzing(false);
    setAnalyzeError(null);
    setSuggestions(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files).slice(0, MAX_AI_PHOTOS - photos.length);
    if (newFiles.length === 0) return;
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setPhotos((prev) => [...prev, ...newFiles]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
    setSuggestions(null);
    setAnalyzeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleRemovePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setSuggestions(null);
    setAnalyzeError(null);
  }

  async function handleAnalyze() {
    if (photos.length === 0) return;
    if (!aiSettings) {
      setAiSetupOpen(true);
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const compressedFiles = await Promise.all(
        photos.map(async (p) => {
          const compressed = await compressImage(p);
          return compressed instanceof File
            ? compressed
            : new File([compressed], p.name, { type: compressed.type || 'image/jpeg' });
        })
      );
      const result = await analyzeImageFiles(compressedFiles, activeLocationId || undefined);
      setSuggestions(result);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to analyze photos');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleApplySuggestions(changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string }>) {
    if (changes.name !== undefined) setName(changes.name);
    if (changes.items !== undefined) setItems(changes.items);
    if (changes.tags !== undefined) setTags(changes.tags);
    if (changes.notes !== undefined) setNotes(changes.notes);
    setSuggestions(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !activeLocationId) return;
    setLoading(true);
    try {
      const id = await addBin({
        name: name.trim(),
        locationId: activeLocationId,
        items,
        notes: notes.trim(),
        tags,
        areaId,
        icon,
        color,
      });
      // Upload photos non-blocking (fire-and-forget)
      if (photos.length > 0) {
        Promise.all(
          photos.map((p) =>
            compressImage(p)
              .then((compressed) => addPhoto(id, compressed instanceof File
                ? compressed
                : new File([compressed], p.name, { type: compressed.type || 'image/jpeg' })))
              .catch(() => { /* photo upload is non-blocking */ })
          )
        ).catch(() => { /* ignore */ });
      }
      onOpenChange(false);
      navigate(`/bin/${id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Bin</DialogTitle>
            <DialogDescription>Add a new storage bin to your inventory.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Photos</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
              {photos.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] py-4 text-[14px] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  <Camera className="h-5 w-5" />
                  Add Photo
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {photoPreviews.map((preview, i) => (
                      <div key={i} className="relative shrink-0">
                        <img
                          src={preview}
                          alt={`Preview ${i + 1}`}
                          className="h-14 w-14 rounded-[var(--radius-md)] object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(i)}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center shadow-sm hover:bg-[var(--destructive)] hover:text-white transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {photos.length < MAX_AI_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-14 w-14 shrink-0 flex items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="gap-1.5"
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                    )}
                    {analyzing ? 'Analyzing...' : `Analyze with AI${photos.length > 1 ? ` (${photos.length})` : ''}`}
                  </Button>
                </div>
              )}
              {analyzeError && (
                <p className="text-[13px] text-[var(--destructive)]">{analyzeError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bin-name">Name</Label>
              <Input
                id="bin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Holiday Decorations"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Area</Label>
              <AreaPicker locationId={activeLocationId ?? undefined} value={areaId} onChange={setAreaId} />
            </div>
            <div className="space-y-2">
              <Label>Items</Label>
              <ItemsInput
                items={items}
                onChange={setItems}
                showDictation
                aiConfigured={!!aiSettings}
                onAiSetupNeeded={() => setAiSetupOpen(true)}
                binName={name}
                locationId={activeLocationId ?? undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bin-notes">Notes</Label>
              <Textarea
                id="bin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
            </div>

            {/* AI Suggestions */}
            {suggestions && (
              <div ref={suggestionsRef}>
                <AiSuggestionsPanel
                  suggestions={suggestions}
                  currentName={name}
                  currentItems={items}
                  currentTags={tags}
                  currentNotes={notes}
                  onApply={handleApplySuggestions}
                  onDismiss={() => setSuggestions(null)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || !activeLocationId || loading}>
                {loading ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Setup Guidance Dialog */}
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
                onOpenChange(false);
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
    </>
  );
}
