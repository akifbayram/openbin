import { AlertTriangle, Check, Clock, RefreshCw, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LabelThreshold } from '@/components/ui/ai-progress-bar';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { AiConfiguredIndicator, InlineAiSetup } from '@/features/ai/InlineAiSetup';
import { useAiProviderSetup } from '@/features/ai/useAiProviderSetup';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAreaList } from '@/features/areas/useAreas';
import { getCapturedReturnTarget, hasCapturedPhotos, setCapturedReturnTarget, takeCapturedPhotos } from '@/features/capture/capturedPhotos';
import { useAiEnabled } from '@/lib/aiToggle';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { getSecondaryColorInfo, setSecondaryColor } from '@/lib/cardStyle';
import { aiItemsToBinItems, binItemsToPayload } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { useDictation } from '@/lib/useDictation';
import { cn, focusRing, plural } from '@/lib/utils';
import type { AiSuggestions, BinItem, BinVisibility } from '@/types';
import { AiBadge } from './AiBadge';
import { BinPreviewCard } from './BinPreviewCard';
import { ColorPicker } from './ColorPicker';
import { CustomFieldsEditCard } from './CustomFieldsEditCard';
import { IconPicker } from './IconPicker';
import { ItemList } from './ItemList';
import { PhotoUploadSection } from './PhotoUploadSection';
import { QuickAddWidget } from './QuickAddWidget';
import { StylePicker } from './StylePicker';
import { TagInput } from './TagInput';
import { useBinFormFields } from './useBinFormFields';
import { useCustomFields } from './useCustomFields';
import { usePhotoAnalysis } from './usePhotoAnalysis';
import { useQuickAdd } from './useQuickAdd';
import { VisibilityPicker } from './VisibilityPicker';

export interface BinCreateFormData {
  name: string;
  items: (string | { name: string; quantity?: number | null })[];
  notes: string;
  tags: string[];
  areaId: string | null;
  icon: string;
  color: string;
  cardStyle: string;
  visibility: BinVisibility;
  customFields: Record<string, string>;
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
  prefillName?: string;
  allTags?: string[];
  header?: React.ReactNode | ((state: { name: string; color: string; items: BinItem[]; tags: string[]; icon: string; cardStyle: string; areaName: string }) => React.ReactNode);
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
  prefillName,
  allTags,
  header,
  className,
}: BinCreateFormProps) {
  const t = useTerminology();
  const { areas } = useAreaList(locationId);
  const { settings: aiSettings, isLoading: aiSettingsLoading } = useAiSettings();
  const { aiEnabled } = useAiEnabled();

  const navigate = useNavigate();
  const location = useLocation();

  function handleCameraClick() {
    setCapturedReturnTarget('bin-create');
    navigate('/capture', { state: { returnTo: location.pathname } });
  }

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
    customFields, setCustomFields,
  } = useBinFormFields({ initialName: prefillName });

  const { fields: customFieldDefs } = useCustomFields(locationId);

  // AI inline auto-populate state
  type AiField = 'name' | 'items' | 'tags' | 'notes';
  const [aiFilledFields, setAiFilledFields] = useState<Set<AiField>>(new Set());
  const [aiFillCycle, setAiFillCycle] = useState(0);
  const preAiValues = useRef<{ name: string; items: BinItem[]; tags: string[]; notes: string } | null>(null);

  // Progressive disclosure
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  // Name validation
  const [nameError, setNameError] = useState<string | null>(null);

  // Onboarding-specific: inline AI setup
  const [aiExpanded, setAiExpanded] = useState(false);
  const setup = useAiProviderSetup({ onSaveSuccess: () => setAiExpanded(false) });
  const aiConfiguredInline = setup.configured || (aiSettings !== null && !aiSettingsLoading);

  // Full mode: inline AI setup
  const [showAiSetup, setShowAiSetup] = useState(false);
  const fullSetup = useAiProviderSetup({ onSaveSuccess: () => setShowAiSetup(false) });

  const isFull = mode === 'full';
  const aiReady = isFull ? (aiEnabled && !!aiSettings) : aiConfiguredInline;
  const showAi = isFull ? aiEnabled : true;

  const handleAiSetupNeeded = () => {
    if (isFull) {
      setShowAiSetup(true);
    } else {
      setAiExpanded(true);
    }
  };

  // Deferred AI result: store result during analysis, apply after completion flash
  const pendingAiResult = useRef<AiSuggestions | null>(null);

  function applyPendingAiResult() {
    const result = pendingAiResult.current;
    if (!result) return;
    pendingAiResult.current = null;

    // preAiValues was snapshotted when the result arrived (in onApplyDirect)
    const filled = new Set<AiField>();

    if (result.name) {
      setName(result.name);
      filled.add('name');
    }
    if (result.items?.length) {
      setItems(aiItemsToBinItems(result.items));
      filled.add('items');
    }
    if (result.tags?.length) {
      const prev = preAiValues.current?.tags ?? [];
      setTags([...new Set([...prev, ...result.tags.map(t => t.toLowerCase())])]);
      filled.add('tags');
    }
    if (result.notes) {
      setNotes(result.notes);
      filled.add('notes');
    }
    if (result.customFields && Object.keys(result.customFields).length > 0) {
      setCustomFields(result.customFields);
    }

    setAiFilledFields(filled);
    setAiFillCycle(c => c + 1);

    if (filled.has('tags') || filled.has('notes')) {
      setMoreOptionsOpen(true);
    }
  }

  const {
    fileInputRef,
    photos,
    photoPreviews,
    analyzing,
    analyzeError,
    handlePhotoSelect,
    handleRemovePhoto,
    addPhotosFromFiles,
    handleAnalyze,
    handleReanalyze,
  } = usePhotoAnalysis({
    locationId,
    aiConfigured: isFull ? aiReady : aiConfiguredInline,
    onApplyDirect: (result) => {
      // Snapshot current values for undo before the 600ms flash
      preAiValues.current = { name, items, tags, notes };
      pendingAiResult.current = result;
      setAnalyzeComplete(true);
    },
    onAiSetupNeeded: handleAiSetupNeeded,
  });

  // Completion flash: hold progress bar at 100% briefly, then apply AI result
  const [analyzeComplete, setAnalyzeComplete] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- applyPendingAiResult reads from refs, no stale closure risk
  // biome-ignore lint/correctness/useExhaustiveDependencies: applyPendingAiResult reads from refs, no stale closure risk
  useEffect(() => {
    if (!analyzeComplete) return;
    const timer = setTimeout(() => {
      setAnalyzeComplete(false);
      applyPendingAiResult();
    }, 600);
    return () => clearTimeout(timer);
  }, [analyzeComplete]);

  // Clear AI success banner when all photos are removed so the user can re-analyze with new photos
  useEffect(() => {
    if (photos.length === 0) {
      setAiFilledFields(new Set());
    }
  }, [photos.length]);

  useEffect(() => {
    function checkCapturedPhotos() {
      if (hasCapturedPhotos() && getCapturedReturnTarget() === 'bin-create') {
        const files = takeCapturedPhotos();
        addPhotosFromFiles(files);
      }
    }
    checkCapturedPhotos();
    window.addEventListener('focus', checkCapturedPhotos);
    return () => window.removeEventListener('focus', checkCapturedPhotos);
  }, [addPhotosFromFiles]);

  function handleUndoAiField(field: 'name' | 'items' | 'tags' | 'notes') {
    if (!preAiValues.current) return;
    switch (field) {
      case 'name': setName(preAiValues.current.name); break;
      case 'items': setItems(preAiValues.current.items); break;
      case 'tags': setTags(preAiValues.current.tags); break;
      case 'notes': setNotes(preAiValues.current.notes); break;
    }
    setAiFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  const quickAdd = useQuickAdd({
    binName: name,
    existingItems: items.map((i) => i.name),
    activeLocationId: locationId,
    aiConfigured: aiReady,
    onNavigateAiSetup: handleAiSetupNeeded,
    onAdd: (newItems) => setItems([...items, ...newItems]),
  });

  const dictation = useDictation({
    binName: name,
    existingItems: items.map((i) => i.name),
    locationId: locationId ?? undefined,
    onAdd: (newItems) => setItems([...items, ...newItems]),
  });

  const canTranscribe = aiReady && !!aiSettings?.provider && aiSettings.provider !== 'anthropic' && isRecordingSupported();

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      items: binItemsToPayload(items),
      notes: notes.trim(),
      tags,
      areaId,
      icon,
      color,
      cardStyle: cardStyle || '',
      visibility,
      customFields,
      photos,
    });
  }

  const compactLabel = 'text-[13px] text-[var(--text-tertiary)] mb-1.5 block';

  const areaName = areas.find(a => a.id === areaId)?.name ?? '';
  const secondaryInfo = getSecondaryColorInfo(cardStyle);
  const renderedHeader = typeof header === 'function'
    ? header({ name, color, items, tags, icon, cardStyle, areaName })
    : header;

  return (
    <form onSubmit={handleFormSubmit} className={cn(isFull ? 'space-y-5' : 'space-y-3', className)}>
      {renderedHeader}

      {/* --- FULL MODE LAYOUT --- */}
      {isFull ? (
        <>
          {/* Photo upload */}
          <PhotoUploadSection
            fileInputRef={fileInputRef}
            photos={photos}
            photoPreviews={photoPreviews}
            onPhotoSelect={handlePhotoSelect}
            onRemovePhoto={handleRemovePhoto}
            onCameraClick={handleCameraClick}
            onFilesDropped={addPhotosFromFiles}
            analyzing={analyzing}
          />

          {/* AI Fill button / Error card / Success banner */}
          {(() => {
            // Error state
            if (analyzeError) {
              const errLower = analyzeError.toLowerCase();
              const isRateLimit = errLower.includes('rate') || errLower.includes('429');
              const isProviderDown = !isRateLimit && (errLower.includes('502') || errLower.includes('unavailable') || errLower.includes('not responding'));
              return (
                <div
                  role="alert"
                  className={cn(
                    'rounded-[var(--radius-md)] border p-3.5',
                    isRateLimit
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-[var(--destructive)]/5 border-[var(--destructive)]/20'
                  )}
                >
                  <div className="flex gap-2.5">
                    {isRateLimit
                      ? <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      : <AlertTriangle className="h-4 w-4 text-[var(--destructive)] shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[13px] font-semibold mb-0.5', isRateLimit ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--destructive)]')}>
                        {isRateLimit ? 'Rate limit reached' : isProviderDown ? 'Provider unavailable' : 'Analysis failed'}
                      </p>
                      <p className="text-[12px] text-[var(--text-tertiary)] mb-2.5">{analyzeError}</p>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={handleAnalyze}>
                          Retry
                        </Button>
                        {!isRateLimit && !isProviderDown && (
                          <Button type="button" size="sm" variant="outline" onClick={() => setShowAiSetup(true)}>
                            Check AI Settings
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Success banner (after AI fill) — wait for completion flash
            if (aiFilledFields.size > 0 && !analyzing && !analyzeComplete) {
              return (
                <output className="rounded-[var(--radius-md)] bg-emerald-500/8 border border-emerald-500/20 px-3.5 py-2.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 min-w-0">AI filled {aiFilledFields.size} {plural(aiFilledFields.size, 'field')}</span>
                  {photos.length > 0 && (
                    <Tooltip content="Re-run AI analysis on your photos with current field values as context">
                      <button
                        type="button"
                        onClick={() => handleReanalyze({
                          name,
                          items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
                          tags,
                          notes,
                        })}
                        className={cn('shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--ai-accent)]/10 text-[var(--ai-accent)] hover:bg-[var(--ai-accent)]/20 transition-colors', focusRing)}
                        aria-label="Reanalyze photos with AI"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    </Tooltip>
                  )}
                </output>
              );
            }

            // AI Fill button / progress bar
            if (aiReady) {
              if (analyzing || analyzeComplete) {
                const photoLabels: LabelThreshold[] = [
                  [0, `Uploading ${photos.length} ${plural(photos.length, 'photo')}...`],
                  [15, 'Identifying items...'],
                  [45, 'Generating details...'],
                  [75, 'Almost done...'],
                ];
                return (
                  <div className="flex items-center justify-center min-h-[44px]">
                    <AiProgressBar
                      active={analyzing}
                      complete={analyzeComplete}
                      labels={photoLabels}
                      className="w-full"
                    />
                  </div>
                );
              }
              return (
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={photos.length === 0}
                  className="w-full gap-1.5 bg-[var(--ai-accent)] hover:bg-[var(--ai-accent-hover)] text-[var(--text-on-accent)] min-h-[44px]"
                >
                  <Sparkles className="h-4 w-4" />
                  {photos.length > 0
                    ? `AI Fill from ${photos.length} ${plural(photos.length, 'photo')}`
                    : 'AI Fill'}
                </Button>
              );
            }

            // AI not configured
            if (showAi) {
              return (
                <button
                  type="button"
                  onClick={handleAiSetupNeeded}
                  className="w-full min-h-[44px] rounded-[var(--radius-md)] bg-[var(--ai-accent)]/6 border border-[var(--ai-accent)]/15 text-[var(--ai-accent)] text-[14px] font-medium flex items-center justify-center gap-1.5 hover:bg-[var(--ai-accent)]/10 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Set up AI to auto-fill details
                </button>
              );
            }

            return null;
          })()}

          {/* Inline AI setup (full mode) */}
          {showAiSetup && !aiReady && (
            <div className="rounded-[var(--radius-md)] border border-[var(--ai-accent)]/15 bg-[var(--ai-accent)]/[0.03] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--ai-accent)]" />
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">Set up AI</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiSetup(false)}
                  className="p-2 -m-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Close AI setup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <InlineAiSetup
                expanded
                onExpandedChange={() => {}}
                setup={fullSetup}
                label=""
              />
            </div>
          )}

          {/* Name with validation and AI badge */}
          <div key={aiFilledFields.has('name') ? `name-${aiFillCycle}` : 'name'} className={cn('space-y-2', aiFilledFields.has('name') && 'ai-field-fill')} style={aiFilledFields.has('name') ? { '--stagger': 0 } as React.CSSProperties : undefined}>
            <div className="flex items-center justify-between">
              <Label htmlFor="bin-name">Name</Label>
              {aiFilledFields.has('name') && <AiBadge onUndo={() => handleUndoAiField('name')} />}
            </div>
            <Input
              id="bin-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(null); }}
              onBlur={() => { if (!name.trim()) setNameError('Name is required'); }}
              placeholder="e.g., Holiday Decorations"
              maxLength={255}
              required
              aria-invalid={!!nameError}
              className={cn(nameError && 'border-[var(--destructive)] focus-visible:ring-[var(--destructive)]')}
            />
            {nameError && (
              <p role="alert" className="text-[12px] text-[var(--destructive)]">
                {nameError}
              </p>
            )}
          </div>

          {/* Items */}
          <div key={aiFilledFields.has('items') ? `items-${aiFillCycle}` : 'items'} className={cn('space-y-2', aiFilledFields.has('items') && 'ai-field-fill')} style={aiFilledFields.has('items') ? { '--stagger': 1 } as React.CSSProperties : undefined}>
            <ItemList items={items} onItemsChange={setItems} hideWhenEmpty headerExtra={aiFilledFields.has('items') ? <AiBadge onUndo={() => handleUndoAiField('items')} /> : undefined} />
            <QuickAddWidget quickAdd={quickAdd} aiEnabled={showAi} dictation={dictation} canTranscribe={canTranscribe} />
          </div>

          {/* More Options accordion with optional fields */}
          <Disclosure
            label="More options"
            open={moreOptionsOpen}
            onOpenChange={setMoreOptionsOpen}
            labelClassName="py-2 text-[var(--accent)] cursor-pointer"
          >
            <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t.Area}</Label>
              <AreaPicker locationId={locationId} value={areaId} onChange={setAreaId} />
            </div>

            <div key={aiFilledFields.has('notes') ? `notes-${aiFillCycle}` : 'notes'} className={cn('space-y-2', aiFilledFields.has('notes') && 'ai-field-fill')} style={aiFilledFields.has('notes') ? { '--stagger': 2 } as React.CSSProperties : undefined}>
              <div className="flex items-center justify-between">
                <Label htmlFor="bin-notes">Notes</Label>
                {aiFilledFields.has('notes') && <AiBadge onUndo={() => handleUndoAiField('notes')} />}
              </div>
              <Textarea
                id="bin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                maxLength={10000}
                rows={2}
              />
            </div>

            <div key={aiFilledFields.has('tags') ? `tags-${aiFillCycle}` : 'tags'} className={cn('space-y-2', aiFilledFields.has('tags') && 'ai-field-fill')} style={aiFilledFields.has('tags') ? { '--stagger': 3 } as React.CSSProperties : undefined}>
              <div className="flex items-center justify-between">
                <Label>Tags</Label>
                {aiFilledFields.has('tags') && <AiBadge onUndo={() => handleUndoAiField('tags')} />}
              </div>
              <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
            </div>

            {customFieldDefs.length > 0 && (
              <Card>
                <CardContent className="space-y-4 pt-3 pb-4">
                  <Label>Custom Fields</Label>
                  <CustomFieldsEditCard
                    fields={customFieldDefs}
                    values={customFields}
                    onChange={setCustomFields}
                  />
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              <Label>Appearance</Label>
              <BinPreviewCard
                name={name}
                color={color}
                items={items.map((i) => i.name)}
                tags={tags}
                icon={icon}
                cardStyle={cardStyle}
                areaName={areaName}
              />
              <div className="space-y-2">
                <Label className="text-[12px]">Icon</Label>
                <IconPicker value={icon} onChange={setIcon} />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px]">Color</Label>
                <ColorPicker
                  value={color}
                  onChange={setColor}
                  secondaryLabel={secondaryInfo?.label}
                  secondaryValue={secondaryInfo?.value}
                  onSecondaryChange={secondaryInfo ? (c) => setCardStyle(setSecondaryColor(cardStyle, c)) : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px]">Style</Label>
                <StylePicker value={cardStyle} color={color} onChange={setCardStyle} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <VisibilityPicker value={visibility} onChange={setVisibility} />
            </div>
            </div>
          </Disclosure>
        </>
      ) : (
        /* --- ONBOARDING MODE LAYOUT --- */
        <>
          {/* Name */}
          <div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${t.Bin} name`}
              maxLength={255}
              required
              autoFocus
            />
          </div>

          {/* Items */}
          <div className="text-left">
            <ItemList items={items} onItemsChange={setItems} hideWhenEmpty />
            <QuickAddWidget quickAdd={quickAdd} aiEnabled={showAi} dictation={dictation} canTranscribe={canTranscribe} />
          </div>

          {/* Area */}
          <div className="text-left">
            <label htmlFor="bin-area" className={compactLabel}>{t.Area}</label>
            <AreaPicker locationId={locationId} value={areaId} onChange={setAreaId} />
          </div>

          {/* Photo upload */}
          <PhotoUploadSection
            fileInputRef={fileInputRef}
            photos={photos}
            photoPreviews={photoPreviews}
            onPhotoSelect={handlePhotoSelect}
            onRemovePhoto={handleRemovePhoto}
            onCameraClick={handleCameraClick}
            onFilesDropped={addPhotosFromFiles}
            analyzing={analyzing}
          />

          {/* Appearance */}
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
        <div className="flex gap-2 justify-end pt-2">
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
