import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { BinUsageSection } from '@/features/usage/BinUsageSection';
import { getSecondaryColorInfo, setSecondaryColor } from '@/lib/cardStyle';
import { useTerminology } from '@/lib/terminology';
import type { useDictation } from '@/lib/useDictation';
import { cn, disclosureSectionLabel } from '@/lib/utils';
import type { AiSuggestions, Bin, CustomField, ItemCheckout, Photo } from '@/types';
import { BinPreviewCard } from './BinPreviewCard';
import { ColorPicker } from './ColorPicker';
import { CustomFieldsEditCard } from './CustomFieldsEditCard';
import { CustomFieldsViewCard } from './CustomFieldsViewCard';
import { IconPicker } from './IconPicker';
import { ItemList } from './ItemList';
import { QuickAddWidget } from './QuickAddWidget';
import { StylePicker } from './StylePicker';
import { TagInput } from './TagInput';
import type { useAutoSaveBin } from './useAutoSaveBin';
import type { useQuickAdd } from './useQuickAdd';
import { VisibilityPicker } from './VisibilityPicker';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface BinDetailContentProps {
  bin: Bin;
  autoSave: ReturnType<typeof useAutoSaveBin>;
  photosSection: ReactNode;
  canEdit: boolean;
  canChangeVisibility: boolean;
  quickAdd: ReturnType<typeof useQuickAdd>;
  dictation: ReturnType<typeof useDictation>;
  canTranscribe: boolean;
  allTags: string[];
  aiEnabled: boolean;
  aiGated?: boolean;
  onUpgrade?: () => void;
  aiError: string | null;
  suggestions: AiSuggestions | null;
  previousResult: AiSuggestions | null;
  customFields: CustomField[];
  photos: Photo[];
  activeLocationId: string | undefined;
  checkouts?: ItemCheckout[];
  onApplySuggestions: (changes: Partial<{ name: string; items: { name: string; quantity?: number | null }[]; tags: string[]; notes: string; customFields: Record<string, string> }>) => void;
  onClearSuggestions: () => void;
}

export function BinDetailContent({
  bin,
  autoSave,
  photosSection,
  canEdit,
  canChangeVisibility,
  quickAdd,
  dictation,
  canTranscribe,
  allTags,
  aiEnabled,
  aiGated,
  onUpgrade,
  aiError,
  suggestions,
  previousResult,
  customFields,
  photos,
  activeLocationId,
  checkouts,
  onApplySuggestions,
  onClearSuggestions,
}: BinDetailContentProps) {
  const navigate = useNavigate();
  const getTagStyle = useTagStyle();
  const t = useTerminology();
  // Local state for optimistic updates — synced from bin prop on server refetch
  const [localNotes, setLocalNotes] = useState(bin.notes);
  const [localIcon, setLocalIcon] = useState(bin.icon);
  const [localColor, setLocalColor] = useState(bin.color);
  const [localCardStyle, setLocalCardStyle] = useState(bin.card_style);
  const [localCustomFields, setLocalCustomFields] = useState(bin.custom_fields || {});

  const prevNotes = useRef(bin.notes);
  const prevIcon = useRef(bin.icon);
  const prevColor = useRef(bin.color);
  const prevCardStyle = useRef(bin.card_style);
  const prevCustomFields = useRef(bin.custom_fields);

  if (bin.notes !== prevNotes.current) { prevNotes.current = bin.notes; setLocalNotes(bin.notes); }
  if (bin.icon !== prevIcon.current) { prevIcon.current = bin.icon; setLocalIcon(bin.icon); }
  if (bin.color !== prevColor.current) { prevColor.current = bin.color; setLocalColor(bin.color); }
  if (bin.card_style !== prevCardStyle.current) { prevCardStyle.current = bin.card_style; setLocalCardStyle(bin.card_style); }
  if (bin.custom_fields !== prevCustomFields.current) { prevCustomFields.current = bin.custom_fields; setLocalCustomFields(bin.custom_fields || {}); }

  const secondaryInfo = getSecondaryColorInfo(localCardStyle);
  const areaName = bin.area_name;
  const hasTags = bin.tags.length > 0;

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[3fr_2fr] lg:items-start gap-4">
      {/* Left column */}
      <div className="flex flex-col gap-4">
        {/* AI error */}
        {aiError && (
          <Card className="border-t-2 border-t-[var(--destructive)]">
            <CardContent>
              <p className="text-[14px] text-[var(--destructive)]">{aiError}</p>
              <button type="button" onClick={onClearSuggestions} className="mt-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Dismiss
              </button>
            </CardContent>
          </Card>
        )}

        {/* AI suggestions */}
        {suggestions && (
          <AiSuggestionsPanel
            suggestions={suggestions}
            previousResult={previousResult}
            currentName={bin.name}
            currentItems={bin.items}
            currentTags={bin.tags}
            currentNotes={bin.notes}
            customFieldDefs={customFields}
            currentCustomFields={bin.custom_fields}
            onApply={onApplySuggestions}
            onDismiss={onClearSuggestions}
          />
        )}

        {/* Items card */}
        <Card>
          <CardContent className="pt-3 pb-4">
            <ItemList items={bin.items} binId={bin.id} readOnly={!canEdit} collapsible checkouts={checkouts} />
            {canEdit && <QuickAddWidget quickAdd={quickAdd} aiEnabled={aiEnabled} aiGated={aiGated} onUpgrade={onUpgrade} dictation={dictation} canTranscribe={canTranscribe} />}
          </CardContent>
        </Card>

        {photosSection}
        <BinUsageSection binId={bin.id} />
      </div>

      {/* Right column */}
      <div className="lg:sticky lg:top-6 flex flex-col gap-4">
        {/* Notes card */}
        <Card>
          <CardContent className="!py-0">
            <Disclosure
              label="Notes"
              labelClassName={disclosureSectionLabel}
              defaultOpen={localStorage.getItem('openbin-notes-expanded') !== 'false'}
              onOpenChange={(v) => localStorage.setItem('openbin-notes-expanded', String(v))}
            >
              <div className={cn('pb-4', autoSave.savedFields.has('notes') && 'animate-save-flash')}>
                {canEdit ? (
                  <Textarea
                    id="detail-notes"
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    onBlur={() => autoSave.saveNotes(localNotes)}
                    maxLength={10000}
                    rows={3}
                    className="[field-sizing:content] min-h-[5rem]"
                    placeholder="Add notes..."
                  />
                ) : (
                  bin.notes ? (
                    <p className="text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                      {bin.notes}
                    </p>
                  ) : (
                    <p className="text-[15px] text-[var(--text-quaternary)]">No notes</p>
                  )
                )}
              </div>
            </Disclosure>
          </CardContent>
        </Card>

        {/* Organization: Area + Tags + Visibility */}
        <Card>
          <CardContent className="!py-0">
            <Disclosure
              label="Organization"
              labelClassName={disclosureSectionLabel}
              defaultOpen={localStorage.getItem('openbin-organization-expanded') !== 'false'}
              onOpenChange={(v) => localStorage.setItem('openbin-organization-expanded', String(v))}
            >
              <div className="pb-4 space-y-4">
                <div className={cn(autoSave.savedFields.has('areaId') && 'animate-save-flash')}>
                  <Label>{t.Area}</Label>
                  {canEdit ? (
                    <div className="mt-1.5">
                      <AreaPicker
                        locationId={activeLocationId}
                        value={bin.area_id}
                        onChange={(areaId) => autoSave.saveAreaId(areaId)}
                      />
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[15px] text-[var(--text-primary)]">
                      {areaName || <span className="text-[var(--text-quaternary)]">No area</span>}
                    </p>
                  )}
                </div>
                <div className={cn(autoSave.savedFields.has('tags') && 'animate-save-flash')}>
                  <Label>Tags</Label>
                  {canEdit ? (
                    <div className="mt-2">
                      <TagInput
                        tags={bin.tags}
                        onChange={(tags) => autoSave.saveTags(tags)}
                        suggestions={allTags}
                      />
                    </div>
                  ) : (
                    hasTags ? (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {bin.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            style={getTagStyle(tag)}
                            onClick={() => navigate(`/bins?tags=${encodeURIComponent(tag)}`)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[15px] text-[var(--text-quaternary)]">No tags</p>
                    )
                  )}
                </div>
                {canChangeVisibility && (
                  <div className={cn(autoSave.savedFields.has('visibility') && 'animate-save-flash')}>
                    <Label>Visibility</Label>
                    <div className="mt-1.5">
                      <VisibilityPicker
                        value={bin.visibility}
                        onChange={(v) => autoSave.saveVisibility(v)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Disclosure>
          </CardContent>
        </Card>

        {/* Custom Fields */}
        {(canEdit ? customFields.length > 0 : customFields.some((f) => bin.custom_fields[f.id]?.trim())) && (
          <Card>
            <CardContent className="!py-0">
              <Disclosure
                label="Custom Fields"
                labelClassName={disclosureSectionLabel}
                defaultOpen={localStorage.getItem('openbin-custom-fields-expanded') !== 'false'}
                onOpenChange={(v) => localStorage.setItem('openbin-custom-fields-expanded', String(v))}
              >
                <div className="pb-4">
                  {canEdit ? (
                    <CustomFieldsEditCard
                      fields={customFields}
                      values={localCustomFields}
                      onChange={(values) => {
                        setLocalCustomFields(values);
                        autoSave.saveCustomFields(values);
                      }}
                    />
                  ) : (
                    <CustomFieldsViewCard fields={customFields} values={bin.custom_fields} />
                  )}
                </div>
              </Disclosure>
            </CardContent>
          </Card>
        )}

        {/* Appearance disclosure — edit only */}
        {canEdit && (
          <Card>
            <CardContent className="!py-0">
              <Disclosure
                label="Appearance"
                labelClassName={disclosureSectionLabel}
                defaultOpen={localStorage.getItem('openbin-appearance-expanded') === 'true'}
                onOpenChange={(v) => localStorage.setItem('openbin-appearance-expanded', String(v))}
              >
                <div className="pb-4 space-y-5">
                  <div className="space-y-3">
                    <Label>Preview</Label>
                    <BinPreviewCard
                      name={bin.name}
                      color={localColor}
                      items={bin.items.map((i) => i.name)}
                      tags={bin.tags}
                      icon={localIcon}
                      cardStyle={localCardStyle}
                      areaName={areaName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <IconPicker
                      value={localIcon}
                      onChange={(icon) => {
                        setLocalIcon(icon);
                        autoSave.saveIcon(icon);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <ColorPicker
                      value={localColor}
                      onChange={(color) => {
                        setLocalColor(color);
                        autoSave.saveColor(color);
                      }}
                      secondaryLabel={secondaryInfo?.label}
                      secondaryValue={secondaryInfo?.value}
                      onSecondaryChange={secondaryInfo ? (c) => {
                        const newStyle = setSecondaryColor(localCardStyle, c);
                        setLocalCardStyle(newStyle);
                        autoSave.saveCardStyle(newStyle);
                      } : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Style</Label>
                    <StylePicker
                      value={localCardStyle}
                      color={localColor}
                      onChange={(style) => {
                        setLocalCardStyle(style);
                        autoSave.saveCardStyle(style);
                      }}
                      photos={photos}
                    />
                  </div>
                </div>
              </Disclosure>
            </CardContent>
          </Card>
        )}

        {/* Information: created by, dates */}
        <Card>
          <CardContent className="!py-0">
            <Disclosure
              label="Information"
              labelClassName={disclosureSectionLabel}
              defaultOpen={localStorage.getItem('openbin-info-expanded') === 'true'}
              onOpenChange={(v) => localStorage.setItem('openbin-info-expanded', String(v))}
            >
              <div className="pb-4 space-y-4">
                {bin.created_by_name && (
                  <div>
                    <p className="text-[13px] text-[var(--text-tertiary)]">Created by</p>
                    <p className="mt-0.5 text-[15px] text-[var(--text-primary)]">
                      {bin.created_by_name}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[13px] text-[var(--text-tertiary)]">Created</p>
                    <p className="mt-0.5 text-[15px] text-[var(--text-primary)]">
                      {formatDate(bin.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] text-[var(--text-tertiary)]">Updated</p>
                    <p className="mt-0.5 text-[15px] text-[var(--text-primary)]">
                      {formatDate(bin.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            </Disclosure>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card data-tour="qr-section">
          <CardContent className="!py-0">
            <Disclosure
              label="QR Code"
              labelClassName={disclosureSectionLabel}
              defaultOpen={localStorage.getItem('openbin-qr-expanded') === 'true'}
              onOpenChange={(v) => localStorage.setItem('openbin-qr-expanded', String(v))}
            >
              <div className="pb-4 space-y-4">
                <div className="flex flex-col items-center">
                  <QRCodeDisplay binId={bin.id} size={160} />
                </div>
                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <Label>Code</Label>
                  <p className="mt-1.5 text-[15px] font-mono tracking-widest text-[var(--text-primary)]">
                    {bin.short_code}
                  </p>
                </div>
              </div>
            </Disclosure>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
