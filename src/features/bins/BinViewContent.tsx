import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { Label } from '@/components/ui/label';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { useTerminology } from '@/lib/terminology';
import { disclosureSectionLabel } from '@/lib/utils';
import type { AiSuggestions, Bin, CustomField } from '@/types';
import { CustomFieldsViewCard } from './CustomFieldsViewCard';
import { ItemList } from './ItemList';
import { QuickAddWidget } from './QuickAddWidget';
import type { useQuickAdd } from './useQuickAdd';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface BinViewContentProps {
  bin: Bin;
  photosSection: ReactNode;
  canEdit: boolean;
  quickAdd: ReturnType<typeof useQuickAdd>;
  aiEnabled: boolean;
  aiGated?: boolean;
  onUpgrade?: () => void;
  aiError: string | null;
  suggestions: AiSuggestions | null;
  previousResult: AiSuggestions | null;
  hasNotes: boolean;
  hasTags: boolean;
  customFields: CustomField[];
  onApplySuggestions: (changes: Partial<{ name: string; items: { name: string; quantity?: number | null }[]; tags: string[]; notes: string; customFields: Record<string, string> }>) => void;
  onClearSuggestions: () => void;
}

export function BinViewContent({
  bin,
  photosSection,
  canEdit,
  quickAdd,
  aiEnabled,
  aiGated,
  onUpgrade,
  aiError,
  suggestions,
  previousResult,
  hasNotes,
  hasTags,
  customFields,
  onApplySuggestions,
  onClearSuggestions,
}: BinViewContentProps) {
  const navigate = useNavigate();
  const getTagStyle = useTagStyle();
  const t = useTerminology();

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[3fr_2fr] lg:items-start gap-4">
      {/* Left column */}
      <div className="flex flex-col gap-4">
        {/* AI error */}
        {aiError && (
          <Card className="border-t-2 border-t-[var(--destructive)]">
            <CardContent>
              <p className="text-[14px] text-[var(--destructive)]">{aiError}</p>
              <Button variant="ghost" size="sm" onClick={onClearSuggestions} className="mt-2">
                Dismiss
              </Button>
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
            <ItemList items={bin.items} binId={bin.id} readOnly={!canEdit} collapsible />
            {canEdit && <QuickAddWidget quickAdd={quickAdd} aiEnabled={aiEnabled} aiGated={aiGated} onUpgrade={onUpgrade} />}
          </CardContent>
        </Card>

        {/* Notes card */}
        {hasNotes && (
          <Card>
            <CardContent className="pt-3 pb-4">
              <Label>Notes</Label>
              <p className="mt-2 text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {bin.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {photosSection}
      </div>

      {/* Right column */}
      <div className="lg:sticky lg:top-6 flex flex-col gap-4">
        {/* Area & Tags card */}
        {(bin.area_name || hasTags) && (
          <Card>
            <CardContent className="space-y-4 pt-3 pb-4">
              {bin.area_name && (
                <div>
                  <Label>{t.Area}</Label>
                  <p className="mt-1.5 text-[15px] text-[var(--text-primary)]">
                    {bin.area_name}
                  </p>
                </div>
              )}
              {hasTags && (
                <div>
                  <Label>Tags</Label>
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
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Custom Fields */}
        <CustomFieldsViewCard fields={customFields} values={bin.custom_fields} />

        {/* QR Code & Info */}
        <Card data-tour="qr-section">
          <CardContent className="!py-0">
            <Disclosure
              label="QR Code & Info"
              labelClassName={disclosureSectionLabel}
              defaultOpen={localStorage.getItem('openbin-qr-expanded') === 'true'}
              onOpenChange={(v) => localStorage.setItem('openbin-qr-expanded', String(v))}
            >
              <div className="pb-4 space-y-4">
                <div className="flex flex-col items-center">
                  <QRCodeDisplay binId={bin.id} size={160} />
                </div>
                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <div className="mb-4">
                    <Label>Code</Label>
                    <p className="mt-1.5 text-[15px] font-mono tracking-widest text-[var(--text-primary)]">
                      {bin.short_code}
                    </p>
                  </div>
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
            </Disclosure>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
