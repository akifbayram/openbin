import { useState, useRef, useEffect } from 'react';
import { Camera, HelpCircle, Pencil, Sparkles, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TagInput } from './TagInput';
import { ItemsInput } from './ItemsInput';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { StylePicker } from './StylePicker';
import { getSecondaryColorInfo, setSecondaryColor } from '@/lib/cardStyle';
import { derivePrefix } from '@/lib/derivePrefix';
import { VisibilityPicker } from './VisibilityPicker';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAreaList } from '@/features/areas/useAreas';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { analyzeImageFiles, MAX_AI_PHOTOS } from '@/features/ai/useAiAnalysis';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { compressImage } from '@/features/photos/compressImage';
import { useAiProviderSetup } from '@/features/ai/useAiProviderSetup';
import { InlineAiSetup, AiConfiguredIndicator } from '@/features/ai/InlineAiSetup';
import { useTerminology } from '@/lib/terminology';
import type { AiSuggestions, BinVisibility } from '@/types';

export interface BinCreateFormData {
  name: string;
  items: string[];
  notes: string;
  tags: string[];
  areaId: string | null;
  icon: string;
  color: string;
  cardStyle: string;
  visibility: BinVisibility;
  shortCodePrefix: string;
  photos: File[];
}

interface BinCreateFormProps {
  mode: 'full' | 'onboarding';
  locationId: string;
  onSubmit: (data: BinCreateFormData) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  showCancel?: boolean;
  onCancel?: () => void;
  onAiSetupRedirect?: () => void;
  prefillName?: string;
  allTags?: string[];
  header?: React.ReactNode | ((state: { name: string; color: string; items: string[]; tags: string[]; icon: string; cardStyle: string; areaName: string }) => React.ReactNode);
  className?: string;
}

export function BinCreateForm({
  mode,
  locationId,
  onSubmit,
  submitting,
  submitLabel,
  showCancel,
  onCancel,
  onAiSetupRedirect,
  prefillName,
  allTags,
  header,
  className,
}: BinCreateFormProps) {
  const t = useTerminology();
  const { areas } = useAreaList(locationId);
  const { settings: aiSettings, isLoading: aiSettingsLoading } = useAiSettings();
  const { aiEnabled } = useAiEnabled();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(prefillName ?? '');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [cardStyle, setCardStyle] = useState('');
  const [visibility, setVisibility] = useState<BinVisibility>('location');
  const [shortCode, setShortCode] = useState('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  // Short code generation
  const LETTER_CHARSET = 'ABCDEFGHJKMNPQRTUVWXY';
  const randomSuffix = () => {
    let s = '';
    for (let i = 0; i < 3; i++) s += LETTER_CHARSET[Math.floor(Math.random() * LETTER_CHARSET.length)];
    return s;
  };
  const derivedPrefix = name.trim() ? derivePrefix(name.trim()) : '';
  const [autoSuffix, setAutoSuffix] = useState(() => randomSuffix());
  const displayCode = codeManuallyEdited ? shortCode : (derivedPrefix ? derivedPrefix + autoSuffix : '');

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestions | null>(null);
  const [showCodeHelp, setShowCodeHelp] = useState(false);
  const [codeEditing, setCodeEditing] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Onboarding-specific: inline AI setup
  const [aiExpanded, setAiExpanded] = useState(false);
  const setup = useAiProviderSetup({ onSaveSuccess: () => setAiExpanded(false) });
  const aiConfiguredInline = setup.configured || (aiSettings !== null && !aiSettingsLoading);

  // Auto-focus code input when entering edit mode
  useEffect(() => {
    if (codeEditing) codeInputRef.current?.focus();
  }, [codeEditing]);

  // Revoke ObjectURLs on cleanup
  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  // Scroll suggestions into view when they appear (full mode)
  useEffect(() => {
    if (suggestions && suggestionsRef.current) {
      suggestionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [suggestions]);

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
    // In full mode, redirect to settings if AI not configured
    if (mode === 'full') {
      if (!aiSettings) {
        onAiSetupRedirect?.();
        return;
      }
    } else {
      // In onboarding mode, guide to inline setup
      if (!aiConfiguredInline) {
        setAiExpanded(true);
        setAnalyzeError('Configure an AI provider below to analyze photos');
        return;
      }
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
      const result = await analyzeImageFiles(compressedFiles, locationId);
      if (mode === 'onboarding') {
        // Directly apply suggestions in onboarding mode
        if (result.name) setName(result.name);
        if (result.items?.length) setItems(result.items);
        if (result.tags?.length) setTags(result.tags.map(t => t.toLowerCase()));
      } else {
        setSuggestions(result);
      }
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

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      items,
      notes: notes.trim(),
      tags,
      areaId,
      icon,
      color,
      cardStyle: cardStyle || '',
      visibility,
      shortCodePrefix: displayCode,
      photos,
    });
  }

  const isFull = mode === 'full';

  // Determine AI "configured" and "enabled" for ItemsInput
  const aiReady = isFull ? (aiEnabled && !!aiSettings) : aiConfiguredInline;
  const showAi = isFull ? aiEnabled : true;

  const handleAiSetupNeeded = () => {
    if (isFull) {
      onAiSetupRedirect?.();
    } else {
      setAiExpanded(true);
      setAnalyzeError('Configure an AI provider below to use AI extraction');
    }
  };

  const areaName = areas.find(a => a.id === areaId)?.name ?? '';
  const renderedHeader = typeof header === 'function'
    ? header({ name, color, items, tags, icon, cardStyle, areaName })
    : header;

  return (
    <form onSubmit={handleFormSubmit} className={cn(isFull ? 'space-y-5' : 'space-y-3', className)}>
      {renderedHeader}

      {/* Name + short code */}
      <div className={isFull ? 'space-y-2' : undefined}>
        {isFull && <Label htmlFor="bin-name">Name</Label>}
        <Input
          id={isFull ? 'bin-name' : undefined}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!codeManuallyEdited) setAutoSuffix(randomSuffix());
            if (codeManuallyEdited && !e.target.value.trim()) {
              setCodeManuallyEdited(false);
              setShortCode('');
            }
          }}
          placeholder={isFull ? 'e.g., Holiday Decorations' : `${t.Bin} name`}
          required
          autoFocus
        />
        {isFull && name.trim() && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)]">
              <span>Code:</span>
              {codeEditing ? (
                <input
                  ref={codeInputRef}
                  type="text"
                  value={displayCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);
                    setShortCode(val);
                    setCodeManuallyEdited(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setCodeEditing(false), 150);
                  }}
                  className="w-[7.5ch] bg-[var(--bg-input)] border border-[var(--border)] rounded px-1 py-0.5 text-center font-mono text-[13px] text-[var(--text-primary)] uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  maxLength={6}
                />
              ) : (
                <span className="font-mono text-[13px] tracking-wider bg-[var(--bg-input)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)]">
                  {displayCode}
                </span>
              )}
              <button
                type="button"
                onClick={() => setCodeEditing((v) => !v)}
                className={cn(
                  "inline-flex items-center justify-center h-4 w-4 rounded-full transition-colors",
                  codeEditing
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                )}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowCodeHelp((v) => !v)}
                className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
            {showCodeHelp && (
              <p className="text-[12px] text-[var(--text-tertiary)] leading-snug">
                The 6-letter short code is printed on QR labels to identify this bin. It's auto-generated from the name but you can edit the full code.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className={isFull ? 'space-y-2' : 'text-left'}>
        {isFull ? (
          <Label>Items</Label>
        ) : (
          <label className="text-[13px] text-[var(--text-tertiary)] mb-1.5 block">Items</label>
        )}
        <ItemsInput
          items={items}
          onChange={setItems}
          showAi={showAi}
          aiConfigured={aiReady}
          onAiSetupNeeded={handleAiSetupNeeded}
          binName={name}
          locationId={locationId}
        />
      </div>

      {/* Area */}
      {isFull ? (
        <div className="space-y-2">
          <Label>{t.Area}</Label>
          <AreaPicker locationId={locationId} value={areaId} onChange={setAreaId} />
        </div>
      ) : (
        <div className="text-left">
          <label className="text-[13px] text-[var(--text-tertiary)] mb-1.5 block">{t.Area}</label>
          <AreaPicker locationId={locationId} value={areaId} onChange={setAreaId} />
        </div>
      )}

      {/* Notes (full mode only) */}
      {isFull && (
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
      )}

      {/* Tags (full mode only) */}
      {isFull && (
        <div className="space-y-2">
          <Label>Tags</Label>
          <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
        </div>
      )}

      {/* AI Suggestions (full mode only) */}
      {isFull && aiEnabled && suggestions && (
        <div ref={suggestionsRef}>
          <AiSuggestionsPanel
            suggestions={suggestions}
            currentName={name}
            currentItems={items.map((name, i) => ({ id: String(i), name }))}
            currentTags={tags}
            currentNotes={notes}
            onApply={handleApplySuggestions}
            onDismiss={() => setSuggestions(null)}
          />
        </div>
      )}

      {/* Color */}
      <div className={isFull ? 'space-y-2' : 'text-left'}>
        {isFull ? (
          <Label>Color</Label>
        ) : (
          <label className="text-[13px] text-[var(--text-tertiary)] mb-1.5 block">Color</label>
        )}
        {(() => {
          const sec = getSecondaryColorInfo(cardStyle);
          return (
            <ColorPicker
              value={color}
              onChange={setColor}
              secondaryLabel={sec?.label}
              secondaryValue={sec?.value}
              onSecondaryChange={sec ? (c) => setCardStyle(setSecondaryColor(cardStyle, c)) : undefined}
            />
          );
        })()}
      </div>

      {/* Icon */}
      {isFull ? (
        <div className="space-y-2">
          <Label>Icon</Label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
      ) : (
        <div className="text-left">
          <label className="text-[13px] text-[var(--text-tertiary)] mb-1.5 block">Icon</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
      )}

      {/* Style */}
      {isFull ? (
        <div className="space-y-2">
          <Label>Style</Label>
          <StylePicker value={cardStyle} color={color} onChange={setCardStyle} />
        </div>
      ) : (
        <div className="text-left">
          <label className="text-[13px] text-[var(--text-tertiary)] mb-1.5 block">Style</label>
          <StylePicker value={cardStyle} color={color} onChange={setCardStyle} />
        </div>
      )}

      {/* Photo upload */}
      <div className={cn(isFull ? 'space-y-2' : 'text-left')}>
        {isFull && <Label>Photos</Label>}
        <input
          ref={fileInputRef}
          type="file"
          accept={isFull ? 'image/*' : 'image/jpeg,image/png,image/webp,image/gif'}
          {...(!isFull && { capture: 'environment' as const })}
          multiple
          className="hidden"
          onChange={handlePhotoSelect}
        />
        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed text-[14px] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]',
              isFull
                ? 'border-[var(--border)] py-4 text-[var(--text-tertiary)]'
                : 'border-[var(--border-primary)] py-3 text-[var(--text-tertiary)]'
            )}
          >
            <Camera className={cn(isFull ? 'h-5 w-5' : 'h-4 w-4')} />
            Add Photo
          </button>
        ) : (
          <div className="space-y-2">
            <div className={cn(
              'flex items-center gap-2 overflow-x-auto',
              !isFull && 'rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2'
            )}>
              {photoPreviews.map((preview, i) => (
                <div key={i} className="relative shrink-0">
                  <img
                    src={preview}
                    alt={`Preview ${i + 1}`}
                    className={cn(
                      'h-14 w-14 object-cover',
                      isFull ? 'rounded-[var(--radius-md)]' : 'rounded-[var(--radius-sm)]'
                    )}
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
                  className={cn(
                    'h-14 w-14 shrink-0 flex items-center justify-center border-2 border-dashed border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors',
                    isFull ? 'rounded-[var(--radius-md)]' : 'rounded-[var(--radius-sm)]'
                  )}
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>
            {isFull ? (
              aiEnabled && (
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
                    <Sparkles className="h-4 w-4 text-[var(--ai-accent)]" />
                  )}
                  {analyzing ? 'Analyzing...' : `Analyze with AI${photos.length > 1 ? ` (${photos.length})` : ''}`}
                </Button>
              )
            ) : (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-1.5 text-[13px] text-[var(--ai-accent)] hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {analyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {analyzing ? 'Analyzing...' : `Analyze with AI${photos.length > 1 ? ` (${photos.length})` : ''}`}
              </button>
            )}
          </div>
        )}
        {analyzeError && (
          <p className={cn('text-[var(--destructive)]', isFull ? 'text-[13px]' : 'text-[12px] mt-1')}>{analyzeError}</p>
        )}
      </div>

      {/* Visibility (full mode only) */}
      {isFull && (
        <div className="space-y-2">
          <Label>Visibility</Label>
          <VisibilityPicker value={visibility} onChange={setVisibility} />
        </div>
      )}

      {/* Inline AI setup (onboarding mode only) */}
      {!isFull && !aiSettingsLoading && (
        <div className="text-left">
          {aiConfiguredInline ? (
            <AiConfiguredIndicator>
              {photos.length > 0 && (
                <span className="text-[var(--text-tertiary)]">— tap <Sparkles className="h-3 w-3 inline" /> to analyze</span>
              )}
            </AiConfiguredIndicator>
          ) : (
            <InlineAiSetup
              expanded={aiExpanded}
              onExpandedChange={setAiExpanded}
              setup={setup}
              label="Set up AI Analysis"
            />
          )}
        </div>
      )}

      {/* Footer */}
      {isFull ? (
        <div className="flex items-center justify-end gap-2 pt-2">
          {showCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={!name.trim() || submitting}>
            {submitting ? 'Creating...' : (submitLabel ?? 'Create')}
          </Button>
        </div>
      ) : (
        <Button
          type="submit"
          disabled={!name.trim() || submitting}
          className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
        >
          {submitting ? 'Creating...' : (submitLabel ?? `Create ${t.Bin}`)}
        </Button>
      )}
    </form>
  );
}
