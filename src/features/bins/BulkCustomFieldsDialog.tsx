import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { BulkUpdateDialog, pluralizeBins } from './BulkUpdateDialog';
import { updateBin } from './useBins';
import { useCustomFields } from './useCustomFields';

interface BulkCustomFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkCustomFieldsDialog({ open, onOpenChange, binIds, onDone }: BulkCustomFieldsDialogProps) {
  const { activeLocationId } = useAuth();
  const { fields } = useCustomFields(open ? activeLocationId : null);
  const [values, setValues] = useState<Record<string, string>>({});

  function handleChange(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  const hasValues = Object.values(values).some((v) => v.trim());

  async function apply(ids: string[]) {
    const nonEmpty = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.trim()),
    );
    if (Object.keys(nonEmpty).length === 0) return;
    await Promise.all(ids.map((id) => updateBin(id, { customFields: nonEmpty })));
    setValues({});
  }

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Set Custom Fields"
      description={`Set custom field values for ${pluralizeBins(binIds.length)}. Only filled fields will be updated.`}
      binIds={binIds}
      onApply={apply}
      onApplied={onDone}
      applyDisabled={!hasValues}
    >
      <div className="space-y-3">
        {fields.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">
            No custom fields defined for this location.
          </p>
        ) : (
          fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={`bulk-cf-${field.id}`}>{field.name}</Label>
              <Input
                id={`bulk-cf-${field.id}`}
                value={values[field.id] ?? ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                placeholder={field.name}
              />
            </div>
          ))
        )}
      </div>
    </BulkUpdateDialog>
  );
}
