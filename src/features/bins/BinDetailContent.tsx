import { AiSuggestionsPanel } from '@/features/ai/AiSuggestionsPanel';
import type { useDictation } from '@/lib/useDictation';
import type { AiSuggestions, Bin, CustomField, ItemCheckout, Photo } from '@/types';
import { BinDetailRail } from './BinDetailRail';
import { BinDetailTabs } from './BinDetailTabs';
import type { useAutoSaveBin } from './useAutoSaveBin';
import type { useQuickAdd } from './useQuickAdd';

interface BinDetailContentProps {
  bin: Bin;
  autoSave: ReturnType<typeof useAutoSaveBin>;
  canEdit: boolean;
  canChangeVisibility: boolean;
  canChangeCode: boolean;
  onChangeCode: () => void;
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
  onApplySuggestions: (changes: Partial<{
    name: string;
    items: { name: string; quantity?: number | null }[];
    tags: string[];
    notes: string;
    customFields: Record<string, string>;
  }>) => void;
  onClearSuggestions: () => void;
}

export function BinDetailContent({
  bin,
  autoSave,
  canEdit,
  canChangeVisibility,
  canChangeCode,
  onChangeCode,
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
  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-6">
      <div className="min-w-0">
        {aiError && (
          <div className="border-t-2 border-t-[var(--destructive)] py-3 mb-4">
            <p className="text-[14px] text-[var(--destructive)]">{aiError}</p>
            <button
              type="button"
              onClick={onClearSuggestions}
              className="mt-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Dismiss
            </button>
          </div>
        )}

        {suggestions && (
          <div className="mb-4">
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
          </div>
        )}

        <BinDetailTabs
          bin={bin}
          autoSave={autoSave}
          canEdit={canEdit}
          quickAdd={quickAdd}
          dictation={dictation}
          canTranscribe={canTranscribe}
          aiEnabled={aiEnabled}
          aiGated={aiGated}
          onUpgrade={onUpgrade}
          customFields={customFields}
          photos={photos}
          checkouts={checkouts}
        />
      </div>

      <div className="mt-6 xl:mt-0 xl:sticky xl:top-6 xl:self-start xl:bg-[var(--bg-sidebar)] xl:border xl:border-[var(--border-subtle)] xl:rounded-[var(--radius-lg)] xl:p-5">
        <BinDetailRail
          bin={bin}
          autoSave={autoSave}
          canEdit={canEdit}
          canChangeVisibility={canChangeVisibility}
          canChangeCode={canChangeCode}
          onChangeCode={onChangeCode}
          allTags={allTags}
          activeLocationId={activeLocationId}
        />
      </div>
    </div>
  );
}
