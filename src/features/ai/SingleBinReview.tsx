import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { TagInput } from '@/features/bins/TagInput';
import { ItemsInput } from '@/features/bins/ItemsInput';
import { IconPicker } from '@/features/bins/IconPicker';
import { ColorPicker } from '@/features/bins/ColorPicker';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { AiSettingsSection } from './AiSettingsSection';
import { useAiSettings } from './useAiSettings';
import { useAiEnabled } from '@/lib/aiToggle';
import { analyzeImageFiles, mapErrorMessage, MAX_AI_PHOTOS } from './useAiAnalysis';
import { addBin, notifyBinsChanged, useAllTags } from '@/features/bins/useBins';
import { addPhoto } from '@/features/photos/usePhotos';
import { compressImage } from '@/features/photos/compressImage';
import { useAuth } from '@/lib/auth';

interface SingleBinReviewProps {
  files: File[];
  previewUrls: string[];
  sharedAreaId: string | null;
  onBack: () => void;
  onClose: () => void;
}

export function SingleBinReview({ files, previewUrls, sharedAreaId, onBack, onClose }: SingleBinReviewProps) {
  const { activeLocationId } = useAuth();
  const { settings: aiSettings } = useAiSettings();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const allTags = useAllTags();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [areaId, setAreaId] = useState<string | null>(sharedAreaId);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [aiSetupExpanded, setAiSetupExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const autoAnalyzedRef = useRef(false);

  const triggerAnalyze = useCallback(async () => {
    if (!aiSettings) {
      setAiSetupExpanded(true);
      return;
    }
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const compressed = await Promise.all(
        files.slice(0, MAX_AI_PHOTOS).map(async (f) => {
          const blob = await compressImage(f);
          return blob instanceof File
            ? blob
            : new File([blob], f.name, { type: blob.type || 'image/jpeg' });
        })
      );
      const result = await analyzeImageFiles(compressed, activeLocationId || undefined);
      setName(result.name);
      setItems(result.items);
      setTags(result.tags);
      setNotes(result.notes);

    } catch (err) {
      setAnalyzeError(mapErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  }, [files, aiSettings, activeLocationId]);

  // Auto-analyze on mount
  useEffect(() => {
    if (aiEnabled && aiSettings && !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true;
      triggerAnalyze();
    }
  }, [aiEnabled, aiSettings, triggerAnalyze]);

  async function handleCreate() {
    if (!name.trim() || !activeLocationId) return;
    setIsCreating(true);
    try {
      const binId = await addBin({
        name: name.trim(),
        locationId: activeLocationId,
        items,
        notes: notes.trim(),
        tags,
        areaId,
        icon: icon || undefined,
        color: color || undefined,
      });
      // Upload all photos fire-and-forget
      for (const file of files) {
        compressImage(file)
          .then((blob) => {
            const f =
              blob instanceof File
                ? blob
                : new File([blob], file.name, { type: blob.type || 'image/jpeg' });
            return addPhoto(binId, f);
          })
          .catch(() => {});
      }
      notifyBinsChanged();
      showToast({ message: 'Created bin with ' + files.length + ' photo' + (files.length !== 1 ? 's' : '') });
      onClose();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create bin' });
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
          <p className="text-[14px] text-[var(--text-secondary)]">
            Analyzing {Math.min(files.length, MAX_AI_PHOTOS)} photo{Math.min(files.length, MAX_AI_PHOTOS) !== 1 ? 's' : ''}...
          </p>
        </div>
      ) : (
        <>
          {/* Photo preview */}
          <div className="pb-1">
            <div className="relative w-fit max-w-full mx-auto">
              <div className="flex gap-2 overflow-x-auto">
                {previewUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="max-h-64 shrink-0 rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5"
                  />
                ))}
              </div>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={triggerAnalyze}
                  title="Rescan"
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-[var(--ai-accent)] text-white hover:bg-[var(--ai-accent-hover)] transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {analyzeError && (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-red-500/10 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-[var(--destructive)] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] text-[var(--destructive)]">{analyzeError}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={triggerAnalyze}
                  className="mt-1 h-7 px-2 text-[12px]"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Configure AI provider */}
          {aiEnabled && !aiSettings && (
            <div>
              <button
                type="button"
                onClick={() => setAiSetupExpanded(!aiSetupExpanded)}
                className="text-[12px] text-[var(--accent)] font-medium flex items-center gap-0.5"
              >
                Configure AI provider
                {aiSetupExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          )}

          {/* Inline AI Setup */}
          {aiEnabled && aiSetupExpanded && !aiSettings && (
            <AiSettingsSection aiEnabled={aiEnabled} onToggle={setAiEnabled} />
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="single-bin-name">Name</Label>
              <Input
                id="single-bin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Holiday Decorations"
              />
            </div>

            <div className="space-y-2">
              <Label>Area</Label>
              <AreaPicker
                locationId={activeLocationId ?? undefined}
                value={areaId}
                onChange={setAreaId}
              />
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              <ItemsInput items={items} onChange={setItems} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="single-bin-notes">Notes</Label>
              <Textarea
                id="single-bin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes about this bin..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={onBack}
              className="rounded-[var(--radius-full)]"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || isAnalyzing || isCreating}
              className="rounded-[var(--radius-full)]"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Bin'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
