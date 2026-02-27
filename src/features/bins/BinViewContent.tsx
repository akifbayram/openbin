import { type ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ItemList } from './ItemList';
import { QuickAddWidget } from './QuickAddWidget';
import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { resolveColor } from '@/lib/colorPalette';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { useTagColorsContext } from '@/features/tags/TagColorsContext';
import type { useQuickAdd } from './useQuickAdd';
import type { AiSuggestions, Bin } from '@/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface BinViewContentProps {
  bin: Bin;
  photosSection: ReactNode;
  canEdit: boolean;
  quickAdd: ReturnType<typeof useQuickAdd>;
  aiEnabled: boolean;
  aiError: string | null;
  suggestions: AiSuggestions | null;
  hasNotes: boolean;
  hasTags: boolean;
  onApplySuggestions: (changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string }>) => void;
  onClearSuggestions: () => void;
}

export function BinViewContent({
  bin,
  photosSection,
  canEdit,
  quickAdd,
  aiEnabled,
  aiError,
  suggestions,
  hasNotes,
  hasTags,
  onApplySuggestions,
  onClearSuggestions,
}: BinViewContentProps) {
  const { theme } = useTheme();
  const { tagColors } = useTagColorsContext();
  const [qrExpanded, setQrExpanded] = useState(false);

  return (
    <div className="fade-in-fast contents">
      {/* AI error */}
      {aiError && (
        <Card className="border-t-2 border-t-[var(--destructive)]">
          <CardContent>
            <p className="text-[14px] text-[var(--destructive)]">{aiError}</p>
            <Button variant="ghost" size="sm" onClick={onClearSuggestions} className="mt-2 rounded-[var(--radius-full)]">
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
          onApply={onApplySuggestions}
          onDismiss={onClearSuggestions}
        />
      )}

      {/* Items card */}
      <Card>
        <CardContent>
          <ItemList items={bin.items} binId={bin.id} readOnly={!canEdit} />
          {canEdit && <QuickAddWidget quickAdd={quickAdd} aiEnabled={aiEnabled} />}
        </CardContent>
      </Card>

      {/* Notes card */}
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

      {/* Tags card */}
      {hasTags && (
        <Card>
          <CardContent>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {bin.tags.map((tag) => {
                const tagColorKey = tagColors.get(tag);
                const tagPreset = tagColorKey ? resolveColor(tagColorKey) : undefined;
                const tagStyle = tagPreset
                  ? {
                      backgroundColor: tagPreset.bgCss,
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

      {photosSection}

      {/* QR Code & Info */}
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
            <div className="pb-4 space-y-4 animate-fade-in-up">
              <div className="flex flex-col items-center">
                <QRCodeDisplay binId={bin.id} size={160} />
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <div className="mb-4">
                  <Label>Code</Label>
                  <p className="mt-1.5 text-[15px] font-mono tracking-widest text-[var(--text-primary)]">
                    {bin.id}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
