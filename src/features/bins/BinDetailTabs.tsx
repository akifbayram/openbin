import { useEffect, useId, useState } from 'react';
import { OptionGroup, type OptionGroupOption } from '@/components/ui/option-group';
import type { useDictation } from '@/lib/useDictation';
import type { Bin, CustomField, ItemCheckout, Photo } from '@/types';
import { BinDetailContentsTab } from './BinDetailContentsTab';
import { BinDetailInformationTab } from './BinDetailInformationTab';
import { BinDetailPhotosTab } from './BinDetailPhotosTab';
import type { useAutoSaveBin } from './useAutoSaveBin';
import type { useQuickAdd } from './useQuickAdd';

export type BinDetailTab = 'contents' | 'photos' | 'information';

const STORAGE_KEY = 'openbin-detail-tab';

function isTab(v: string | null): v is BinDetailTab {
  return v === 'contents' || v === 'photos' || v === 'information';
}

function readInitialTab(): BinDetailTab {
  if (typeof window === 'undefined') return 'contents';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  // Map legacy 'appearance' value to 'contents' (appearance moved to a dialog)
  if (stored === 'appearance') return 'contents';
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

  const handleChange = (next: BinDetailTab) => {
    setTab(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be disabled (private mode, quota). Non-fatal.
    }
  };

  // 1–3 keyboard shortcuts to switch tabs
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleChange is defined inline each render but is stable in effect; no reactive deps needed
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
      const map: Record<string, BinDetailTab> = {
        '1': 'contents',
        '2': 'photos',
        '3': 'information',
      };
      const next = map[e.key];
      if (!next) return;
      e.preventDefault();
      handleChange(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const options: OptionGroupOption<BinDetailTab>[] = [
    { key: 'contents', label: 'Contents' },
    { key: 'photos', label: 'Photos' },
    { key: 'information', label: 'Info' },
  ];

  return (
    <div>
      <OptionGroup
        options={options}
        value={tab}
        onChange={handleChange}
        size="lg"
        variant="tabs"
        aria-label="Bin sections"
        idPrefix={tabsId}
      />
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
        {tab === 'photos' && (
          <BinDetailPhotosTab binId={bin.id} photos={photos} canEdit={canEdit} />
        )}
        {tab === 'information' && (
          <BinDetailInformationTab bin={bin} checkouts={checkouts} />
        )}
      </div>
    </div>
  );
}
