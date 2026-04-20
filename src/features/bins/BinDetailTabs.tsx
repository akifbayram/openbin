import { useCallback, useEffect, useId, useState } from 'react';
import { OptionGroup, type OptionGroupOption } from '@/components/ui/option-group';
import type { useDictation } from '@/lib/useDictation';
import type { Bin, CustomField, ItemCheckout, Photo } from '@/types';
import { BinDetailContentsTab } from './BinDetailContentsTab';
import { BinDetailFilesTab } from './BinDetailFilesTab';
import { BinDetailInformationTab } from './BinDetailInformationTab';
import type { useAutoSaveBin } from './useAutoSaveBin';
import type { useQuickAdd } from './useQuickAdd';

export type BinDetailTab = 'contents' | 'files' | 'information';

const STORAGE_KEY = 'openbin-detail-tab';

const TAB_OPTIONS: OptionGroupOption<BinDetailTab>[] = [
  { key: 'contents', label: 'Contents' },
  { key: 'files', label: 'Files' },
  { key: 'information', label: 'Info' },
];

function isTab(v: string | null): v is BinDetailTab {
  return v === 'contents' || v === 'files' || v === 'information';
}

function readInitialTab(): BinDetailTab {
  if (typeof window === 'undefined') return 'contents';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  // Remap legacy stored values so users with old localStorage don't land on a dead tab.
  if (stored === 'appearance') return 'contents';
  if (stored === 'photos' || stored === 'attachments') return 'files';
  if (isTab(stored)) return stored;
  return 'contents';
}

interface BinDetailTabsProps {
  bin: Bin;
  autoSave: ReturnType<typeof useAutoSaveBin>;
  canEdit: boolean;
  quickAdd: ReturnType<typeof useQuickAdd>;
  dictation: ReturnType<typeof useDictation>;
  canTranscribe: boolean;
  aiEnabled: boolean;
  aiGated?: boolean;
  onUpgrade?: () => void;
  customFields: CustomField[];
  photos: Photo[];
  checkouts?: ItemCheckout[];
}

export function BinDetailTabs({
  bin,
  autoSave,
  canEdit,
  quickAdd,
  dictation,
  canTranscribe,
  aiEnabled,
  aiGated,
  onUpgrade,
  customFields,
  photos,
  checkouts,
}: BinDetailTabsProps) {
  const [tab, setTab] = useState<BinDetailTab>(() => readInitialTab());
  const tabsId = useId();

  const handleChange = useCallback((next: BinDetailTab) => {
    setTab(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be disabled (private mode, quota). Non-fatal.
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      )
        return;
      if (target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!/^[1-9]$/.test(e.key)) return;
      const idx = Number(e.key);
      if (idx < 1 || idx > TAB_OPTIONS.length) return;
      e.preventDefault();
      handleChange(TAB_OPTIONS[idx - 1].key);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleChange]);

  return (
    <div>
      <div data-tour="bin-tabs">
        <OptionGroup
          options={TAB_OPTIONS}
          value={tab}
          onChange={handleChange}
          size="lg"
          variant="tabs"
          aria-label="Bin sections"
          idPrefix={tabsId}
        />
      </div>
      <div
        key={tab}
        role="tabpanel"
        id={`${tabsId}-panel-${tab}`}
        aria-labelledby={`${tabsId}-tab-${tab}`}
        className="pt-4 motion-safe:animate-fade-in"
      >
        {tab === 'contents' && (
          <BinDetailContentsTab
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
            checkouts={checkouts}
          />
        )}
        {tab === 'files' && (
          <BinDetailFilesTab binId={bin.id} photos={photos} canEdit={canEdit} />
        )}
        {tab === 'information' && <BinDetailInformationTab bin={bin} />}
      </div>
    </div>
  );
}
