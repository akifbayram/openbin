import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { AiConfiguredIndicator, InlineAiSetup } from '@/features/ai/InlineAiSetup';
import { useAiProviderSetup } from '@/features/ai/useAiProviderSetup';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAreaList } from '@/features/areas/useAreas';
import { useAiEnabled } from '@/lib/aiToggle';
import { getSecondaryColorInfo, setSecondaryColor } from '@/lib/cardStyle';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { BinVisibility } from '@/types';
import { BinPreviewCard } from './BinPreviewCard';
import { ColorPicker } from './ColorPicker';
import { IconPicker } from './IconPicker';
import { ItemsInput } from './ItemsInput';
import { PhotoUploadSection } from './PhotoUploadSection';
import { StylePicker } from './StylePicker';
import { TagInput } from './TagInput';
import { useBinFormFields } from './useBinFormFields';
import { usePhotoAnalysis } from './usePhotoAnalysis';
import { VisibilityPicker } from './VisibilityPicker';

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
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const {
    name, setName,
    areaId, setAreaId,
    items, setItems,
    notes, setNotes,
    tags, setTags,
    icon, setIcon,
    color, setColor,
    cardStyle, setCardStyle,
    visibility, setVisibility,
  } = useBinFormFields({ initialName: prefillName });

  // Onboarding-specific: inline AI setup
  const [aiExpanded, setAiExpanded] = useState(false);
  const setup = useAiProviderSetup({ onSaveSuccess: () => setAiExpanded(false) });
  const aiConfiguredInline = setup.configured || (aiSettings !== null && !aiSettingsLoading);

  const {
    fileInputRef,
    photos,
    photoPreviews,
    analyzing,
    analyzeError,
    suggestions,
    dismissSuggestions,
    handlePhotoSelect,
    handleRemovePhoto,
    handleAnalyze,
  } = usePhotoAnalysis({
    locationId,
    mode,
    aiConfigured: mode === 'full' ? !!aiSettings : aiConfiguredInline,
    onApplyDirect: (result) => {
      if (result.name) setName(result.name);
      if (result.items?.length) setItems(result.items);
      if (result.tags?.length) setTags(result.tags.map(t => t.toLowerCase()));
    },
    onAiSetupNeeded: () => {
      if (mode === 'full') {
        onAiSetupRedirect?.();
      } else {
        setAiExpanded(true);
      }
    },
  });

  // Scroll suggestions into view when they appear (full mode)
  useEffect(() => {
    if (suggestions && suggestionsRef.current) {
      suggestionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [suggestions]);

  function handleApplySuggestions(changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string }>) {
    if (changes.name !== undefined) setName(changes.name);
    if (changes.items !== undefined) setItems(changes.items);
    if (changes.tags !== undefined) setTags(changes.tags);
    if (changes.notes !== undefined) setNotes(changes.notes);
    dismissSuggestions();
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
      photos,
    });
  }

  const isFull = mode === 'full';
  const compactLabel = 'text-[13px] text-[var(--text-tertiary)] mb-1.5 block';

  // Determine AI "configured" and "enabled" for ItemsInput
  const aiReady = isFull ? (aiEnabled && !!aiSettings) : aiConfiguredInline;
  const showAi = isFull ? aiEnabled : true;

  const handleAiSetupNeeded = () => {
    if (isFull) {
      onAiSetupRedirect?.();
    } else {
      setAiExpanded(true);
    }
  };

  const areaName = areas.find(a => a.id === areaId)?.name ?? '';
  const secondaryInfo = getSecondaryColorInfo(cardStyle);
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
          onChange={(e) => setName(e.target.value)}
          placeholder={isFull ? 'e.g., Holiday Decorations' : `${t.Bin} name`}
          required
          autoFocus
        />
      </div>

      {/* Items */}
      <div className={isFull ? 'space-y-2' : 'text-left'}>
        {isFull ? (
          <Label htmlFor="bin-items">Items</Label>
        ) : (
          <label htmlFor="bin-items" className={compactLabel}>Items</label>
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

      {/* Organization: Area + Tags */}
      {isFull ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{t.Area}</Label>
            <AreaPicker locationId={locationId} value={areaId} onChange={setAreaId} />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
          </div>
        </div>
      ) : (
        <div className="text-left">
          <label htmlFor="bin-area" className={compactLabel}>{t.Area}</label>
          <AreaPicker locationId={locationId} value={areaId} onChange={setAreaId} />
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
            onDismiss={dismissSuggestions}
          />
        </div>
      )}

      {/* Photo upload */}
      <PhotoUploadSection
        isFull={isFull}
        fileInputRef={fileInputRef}
        photos={photos}
        photoPreviews={photoPreviews}
        onPhotoSelect={handlePhotoSelect}
        onRemovePhoto={handleRemovePhoto}
        onAnalyze={handleAnalyze}
        analyzing={analyzing}
        analyzeError={analyzeError}
        aiEnabled={isFull ? aiEnabled : true}
      />

      {/* Appearance */}
      {isFull ? (
        <div className="space-y-5">
          <Label>Appearance</Label>
          <BinPreviewCard
            name={name}
            color={color}
            items={items}
            tags={tags}
            icon={icon}
            cardStyle={cardStyle}
            areaName={areaName}
          />
          <div className="space-y-2">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker
              value={color}
              onChange={setColor}
              secondaryLabel={secondaryInfo?.label}
              secondaryValue={secondaryInfo?.value}
              onSecondaryChange={secondaryInfo ? (c) => setCardStyle(setSecondaryColor(cardStyle, c)) : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label>Style</Label>
            <StylePicker value={cardStyle} color={color} onChange={setCardStyle} />
          </div>
        </div>
      ) : (
        <>
          <div className="text-left">
            <label htmlFor="bin-color" className={compactLabel}>Color</label>
            <ColorPicker
              value={color}
              onChange={setColor}
              secondaryLabel={secondaryInfo?.label}
              secondaryValue={secondaryInfo?.value}
              onSecondaryChange={secondaryInfo ? (c) => setCardStyle(setSecondaryColor(cardStyle, c)) : undefined}
            />
          </div>
          <div className="text-left">
            <label htmlFor="bin-icon" className={compactLabel}>Icon</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="text-left">
            <label htmlFor="bin-style" className={compactLabel}>Style</label>
            <StylePicker value={cardStyle} color={color} onChange={setCardStyle} />
          </div>
        </>
      )}

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
