import { Check, RefreshCw, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { AiAnalyzeProgress } from '@/features/ai/AiAnalyzeProgress';
import { AiAnalyzeError } from '@/features/ai/AiStreamingPreview';
import { LOCK_BEAT_MS } from '@/features/ai/aiConstants';
import { AiConfiguredIndicator, InlineAiSetup } from '@/features/ai/InlineAiSetup';
import { useAiProviderSetup } from '@/features/ai/useAiProviderSetup';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAreaList } from '@/features/areas/useAreas';
import { setCapturedPhotos, setCapturedReturnTarget } from '@/features/capture/capturedPhotos';
import { getCommandInputRef } from '@/features/tour/TourProvider';
import { CreditCost, visionWeight } from '@/lib/aiCreditCost';
import { useAiEnabled } from '@/lib/aiToggle';
import { getSecondaryColorInfo, setSecondaryColor } from '@/lib/cardStyle';
import { aiItemsToBinItems, binItemsToPayload } from '@/lib/itemQuantities';
import { prefersReducedMotion } from '@/lib/reducedMotion';
import { useTerminology } from '@/lib/terminology';
import { cn, focusRing, plural, sectionHeader, stickyDialogFooter } from '@/lib/utils';
import type { AiSuggestions, BinItem, BinVisibility } from '@/types';
import { AiBadge } from './AiBadge';
import { BinPreviewCard } from './BinPreviewCard';
import { BulkAddHint } from './BulkAddHint';
import { ColorPicker } from './ColorPicker';
import { CustomFieldsEditCard } from './CustomFieldsEditCard';
import { IconPicker } from './IconPicker';
import { ItemList } from './ItemList';
import { PhotoUploadSection } from './PhotoUploadSection';
import { QuickAddWidget } from './QuickAddWidget';
import { StylePicker } from './StylePicker';
import { TagInput } from './TagInput';
import { type AiFillField, useAiFillState } from './useAiFillState';
import { useBinFormFields } from './useBinFormFields';
import { useCustomFields } from './useCustomFields';
import { useItemEntry } from './useItemEntry';
import { usePhotoAnalysis } from './usePhotoAnalysis';
import { VisibilityPicker } from './VisibilityPicker';

const AiCreditEstimate = __EE__
  ? lazy(() => import('@/ee/AiCreditEstimate').then(m => ({ default: m.AiCreditEstimate })))
  : (() => null) as React.FC<{ cost: number; className?: string }>;

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
  initialPhotos?: File[] | null;
  onInitialPhotosConsumed?: () => void;
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
  initialPhotos,
  onInitialPhotosConsumed,
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

  const aiFill = useAiFillState();

  // Progressive disclosure
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  // Hint that nudges users with 2+ photos toward the bulk-add flow.
  // Resets automatically when the user clears their photo selection so a
  // fresh batch can re-trigger the hint.
  const [bulkHintDismissed, setBulkHintDismissed] = useState(false);

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
  const [confirmPhase, setConfirmPhase] = useState<'idle' | 'locking'>('idle');
  const lockTimerRef = useRef<number | null>(null);

  function applyPendingAiResult() {
    const result = pendingAiResult.current;
    if (!result) return;
    pendingAiResult.current = null;

    const filled = new Set<AiFillField>();
    if (result.name) {
      setName(result.name);
      filled.add('name');
    }
    if (result.items?.length) {
      setItems(aiItemsToBinItems(result.items));
      filled.add('items');
    }
    aiFill.markFilled(filled);
  }

  const {
    fileInputRef,
    photos,
    photoPreviews,
    analyzing,
    analyzeError,
    analyzeMode,
    analyzePartialText,
    cancelAnalyze,
    handlePhotoSelect,
    handleRemovePhoto,
    addPhotosFromFiles,
    handleAnalyze,
    handleReanalyze,
  } = usePhotoAnalysis({
    locationId,
    aiConfigured: isFull ? aiReady : aiConfiguredInline,
    onApplyDirect: (result) => {
      aiFill.snapshot({ name, items });
      pendingAiResult.current = result;
      if (prefersReducedMotion()) {
        applyPendingAiResult();
      } else {
        setConfirmPhase('locking');
        lockTimerRef.current = window.setTimeout(() => {
          setConfirmPhase('idle');
          lockTimerRef.current = null;
          applyPendingAiResult();
        }, LOCK_BEAT_MS);
      }
    },
    onAiSetupNeeded: handleAiSetupNeeded,
  });

  // Cleanup any pending lock timer on unmount.
  useEffect(() => {
    return () => {
      if (lockTimerRef.current !== null) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, []);

  // Clear AI success banner when all photos are removed so the user can re-analyze with new photos.
  useEffect(() => {
    if (photos.length === 0) {
      aiFill.reset();
      setBulkHintDismissed(false);
    }
  }, [photos.length, aiFill.reset]);

  function handleSwitchToBulkAdd() {
    setCapturedPhotos([...photos]);
    setCapturedReturnTarget('bulk-add');
    onCancel?.();
    getCommandInputRef().current?.open();
  }

  const initialPhotosConsumedRef = useRef(false);
  useEffect(() => {
    if (initialPhotosConsumedRef.current) return;
    if (!initialPhotos || initialPhotos.length === 0) return;
    initialPhotosConsumedRef.current = true;
    addPhotosFromFiles(initialPhotos);
    onInitialPhotosConsumed?.();
  }, [initialPhotos, addPhotosFromFiles, onInitialPhotosConsumed]);

  function handleUndoAiField(field: AiFillField) {
    const snap = aiFill.undo(field);
    if (!snap) return;
    if (field === 'name') setName(snap.name);
    else setItems(snap.items);
  }

  const { quickAdd, dictation, canTranscribe } = useItemEntry({
    binName: name,
    existingItems: items.map((i) => i.name),
    locationId: locationId ?? undefined,
    aiReady,
    aiSettings,
    onAdd: (newItems) => setItems([...items, ...newItems]),
    onNavigateAiSetup: handleAiSetupNeeded,
  });

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
    <form onSubmit={handleFormSubmit} className={cn(isFull ? 'flex flex-1 flex-col gap-5' : 'space-y-3', className)}>
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

          {/* Bulk-add nudge: surfaces once the user has 2+ photos, before they tap AI Fill. */}
          {photos.length >= 2
            && !analyzing
            && !analyzeError
            && confirmPhase === 'idle'
            && aiFill.filled.size === 0
            && !bulkHintDismissed && (
            <BulkAddHint
              photoCount={photos.length}
              onSwitch={handleSwitchToBulkAdd}
              onDismiss={() => setBulkHintDismissed(true)}
            />
          )}

          {/* AI Fill button / Error card / Success banner */}
          {(() => {
            // Error state
            if (analyzeError) {
              return (
                <AiAnalyzeError
                  error={analyzeError}
                  onRetry={handleAnalyze}
                  onConfigureAi={() => setShowAiSetup(true)}
                />
              );
            }

            // Success banner (after AI fill) — wait for completion flash
            if (aiFill.filled.size > 0 && !analyzing && confirmPhase !== 'locking') {
              return (
                <output className="rounded-[var(--radius-md)] bg-emerald-500/8 border border-emerald-500/20 px-3.5 py-2.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 min-w-0">AI filled {aiFill.filled.size} {plural(aiFill.filled.size, 'field')}</span>
                  {photos.length > 0 && (
                    <Tooltip content="Re-run AI analysis on your photos with current field values as context">
                      <button
                        type="button"
                        onClick={() => handleReanalyze({
                          name,
                          items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
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
              if (analyzing || confirmPhase === 'locking') {
                const isLocking = confirmPhase === 'locking';
                return (
                  <AiAnalyzeProgress
                    active={analyzing || isLocking}
                    complete={isLocking}
                    mode={isLocking ? 'locking' : analyzeMode}
                    partialText={analyzePartialText}
                    onCancel={analyzing ? cancelAnalyze : undefined}
                    className="w-full"
                  />
                );
              }
              const aiFillCost = visionWeight(photos.length);
              return (
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <Button
                    variant="ai"
                    type="button"
                    onClick={handleAnalyze}
                    disabled={photos.length === 0}
                    className="w-full gap-1.5 min-h-[44px]"
                  >
                    <Sparkles className="h-4 w-4" />
                    {photos.length > 0
                      ? `AI Fill from ${photos.length} ${plural(photos.length, 'photo')}`
                      : 'AI Fill'}
                  </Button>
                  {photos.length > 0 && (
                    __EE__ ? (
                      <Suspense fallback={<CreditCost cost={aiFillCost} />}>
                        <AiCreditEstimate cost={aiFillCost} />
                      </Suspense>
                    ) : (
                      <CreditCost cost={aiFillCost} />
                    )
                  )}
                </div>
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
          <div
            key={aiFill.keyFor('name')}
            className={cn('space-y-2', aiFill.filled.has('name') && 'ai-field-fill')}
            style={aiFill.styleFor('name', 0)}
          >
            <div className="flex items-center justify-between">
              <label htmlFor="bin-name" className={sectionHeader}>Name</label>
              {aiFill.filled.has('name') && <AiBadge onUndo={() => handleUndoAiField('name')} />}
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
          <div
            key={aiFill.keyFor('items')}
            className={cn('space-y-2', aiFill.filled.has('items') && 'ai-field-fill')}
            style={aiFill.styleFor('items', 1)}
          >
            <ItemList
              items={items}
              onItemsChange={setItems}
              headerExtra={aiFill.filled.has('items') ? <AiBadge onUndo={() => handleUndoAiField('items')} /> : undefined}
              footerSlot={
                <QuickAddWidget
                  quickAdd={quickAdd}
                  aiEnabled={showAi}
                  dictation={dictation}
                  canTranscribe={canTranscribe}
                  variant="inline"
                  isEmptyList={items.length === 0}
                />
              }
            />
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
              <span className={sectionHeader}>{t.Area}</span>
              <AreaPicker locationId={locationId} value={areaId} onChange={setAreaId} />
            </div>

            <div className="space-y-2">
              <label htmlFor="bin-notes" className={sectionHeader}>Notes</label>
              <Textarea
                id="bin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                maxLength={10000}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <span className={sectionHeader}>Tags</span>
              <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
            </div>

            {customFieldDefs.length > 0 && (
              <div className="space-y-2">
                <span className={sectionHeader}>Custom Fields</span>
                <CustomFieldsEditCard
                  fields={customFieldDefs}
                  values={customFields}
                  onChange={setCustomFields}
                />
              </div>
            )}

            <div className="space-y-3">
              <span className={sectionHeader}>Appearance</span>
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
                <span className="text-[12px] text-[var(--text-tertiary)]">Icon</span>
                <IconPicker value={icon} onChange={setIcon} />
              </div>
              <div className="space-y-2">
                <span className="text-[12px] text-[var(--text-tertiary)]">Color</span>
                <ColorPicker
                  value={color}
                  onChange={setColor}
                  secondaryLabel={secondaryInfo?.label}
                  secondaryValue={secondaryInfo?.value}
                  onSecondaryChange={secondaryInfo ? (c) => setCardStyle(setSecondaryColor(cardStyle, c)) : undefined}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[12px] text-[var(--text-tertiary)]">Style</span>
                <StylePicker value={cardStyle} color={color} onChange={setCardStyle} />
              </div>
            </div>

            <div className="space-y-2">
              <span className={sectionHeader}>Visibility</span>
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
            <ItemList
              items={items}
              onItemsChange={setItems}
              footerSlot={
                <QuickAddWidget
                  quickAdd={quickAdd}
                  aiEnabled={showAi}
                  dictation={dictation}
                  canTranscribe={canTranscribe}
                  variant="inline"
                  isEmptyList={items.length === 0}
                />
              }
            />
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
        <div className={cn('flex gap-2 justify-end', stickyDialogFooter)}>
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
