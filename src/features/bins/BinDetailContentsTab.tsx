import { useRef, useState } from 'react';
import type { useDictation } from '@/lib/useDictation';
import type { Bin, CustomField, ItemCheckout } from '@/types';
import { CustomFieldsEditCard } from './CustomFieldsEditCard';
import { CustomFieldsViewCard } from './CustomFieldsViewCard';
import { ItemList } from './ItemList';
import { QuickAddWidget } from './QuickAddWidget';
import type { useAutoSaveBin } from './useAutoSaveBin';
import type { useQuickAdd } from './useQuickAdd';

const SUBGROUP_DIVIDER = 'mt-6';

interface BinDetailContentsTabProps {
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
  checkouts?: ItemCheckout[];
}

export function BinDetailContentsTab({
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
  checkouts,
}: BinDetailContentsTabProps) {
  const [localCustomFields, setLocalCustomFields] = useState(bin.custom_fields || {});
  const prevCustomFields = useRef(bin.custom_fields);

  if (bin.custom_fields !== prevCustomFields.current) {
    prevCustomFields.current = bin.custom_fields;
    setLocalCustomFields(bin.custom_fields || {});
  }

  const showCustomFields = canEdit
    ? customFields.length > 0
    : customFields.some((f) => bin.custom_fields[f.id]?.trim());

  return (
    <div>
      <ItemList
        items={bin.items}
        binId={bin.id}
        readOnly={!canEdit}
        hideHeader
        checkouts={checkouts}
        footerSlot={
          canEdit ? (
            <QuickAddWidget
              quickAdd={quickAdd}
              aiEnabled={aiEnabled}
              aiGated={aiGated}
              onUpgrade={onUpgrade}
              dictation={dictation}
              canTranscribe={canTranscribe}
              variant="inline"
            />
          ) : undefined
        }
      />

      {showCustomFields && (
        <div className={SUBGROUP_DIVIDER}>
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
      )}
    </div>
  );
}
