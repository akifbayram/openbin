import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
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
  const [loading, setLoading] = useState(false);

  function handleChange(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleApply() {
    const nonEmpty = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.trim()),
    );
    if (Object.keys(nonEmpty).length === 0) return;
    setLoading(true);
    try {
      await Promise.all(binIds.map((id) => updateBin(id, { customFields: nonEmpty })));
      setValues({});
      onOpenChange(false);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  const hasValues = Object.values(values).some((v) => v.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Custom Fields</DialogTitle>
          <DialogDescription>
            Set custom field values for {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
            Only filled fields will be updated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-[13px] text-[var(--text-tertiary)]">
              No custom fields defined for this location.
            </p>
          ) : (
            fields.map((field) => (
              <div key={field.id} className="stack-xs">
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
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={loading || !hasValues}>
            {loading ? 'Applying...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
