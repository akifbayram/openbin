import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { updateBin } from './useBins';
import { useCustomFields } from './useCustomFields';
import { Button, Drawer, Input } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';

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
    <Drawer.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement={DRAWER_PLACEMENT}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title>Set Custom Fields</Drawer.Title>
            <Drawer.Description>
              Set custom field values for {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
              Only filled fields will be updated.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-3">
              {fields.length === 0 ? (
                <p className="text-[13px] text-gray-500 dark:text-gray-400">
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
          </Drawer.Body>
          <Drawer.Footer flexDirection="column">
            <Button width="full" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button width="full" onClick={handleApply} disabled={loading || !hasValues}>
              {loading ? 'Applying...' : 'Apply'}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
