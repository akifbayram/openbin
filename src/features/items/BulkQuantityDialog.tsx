import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioOption } from '@/components/ui/radio-option';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import { pluralize } from '@/lib/utils';
import type { QuantityOp } from './useItemBulkActions';

const OPTIONS: Array<{ value: QuantityOp; label: string; needsValue: boolean }> = [
  { value: 'set', label: 'Set to', needsValue: true },
  { value: 'inc', label: 'Increment by', needsValue: true },
  { value: 'dec', label: 'Decrement by', needsValue: true },
  { value: 'clear', label: 'Clear quantity', needsValue: false },
];

const DESCRIPTIONS: Record<QuantityOp, string> = {
  set: 'Sets the quantity on every selected item.',
  inc: 'Adds to the existing quantity on every selected item.',
  dec: 'Subtracts from the existing quantity. Items reaching zero will have their quantity cleared.',
  clear: 'Removes the quantity from every selected item.',
};

interface BulkQuantityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onApply: (ids: string[], op: QuantityOp, value?: number) => Promise<void>;
}

export function BulkQuantityDialog({ open, onOpenChange, selectedIds, onApply }: BulkQuantityDialogProps) {
  const [op, setOp] = useState<QuantityOp>('set');
  const [value, setValue] = useState('1');
  const needsValue = OPTIONS.find((o) => o.value === op)?.needsValue ?? true;
  const numValue = Number.parseInt(value, 10);
  const valueValid = !needsValue || (Number.isFinite(numValue) && numValue >= 0);

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) { setOp('set'); setValue('1'); }
        onOpenChange(v);
      }}
      title={`Update quantity for ${pluralize(selectedIds.length, 'item')}`}
      description={DESCRIPTIONS[op]}
      selectedIds={selectedIds}
      onApply={async (ids) => onApply(ids, op, needsValue ? numValue : undefined)}
      applyDisabled={!valueValid}
      applyLabel="Apply"
      loadingLabel="Applying…"
    >
      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <RadioOption
            key={o.value}
            selected={op === o.value}
            onClick={() => setOp(o.value)}
            label={o.label}
          />
        ))}
      </div>

      {needsValue && (
        <div className="flex flex-col gap-1.5 mt-3 animate-fade-in">
          <Label htmlFor="bulk-qty-input">
            {op === 'set' ? 'New quantity' : 'Amount'}
          </Label>
          <Input
            id="bulk-qty-input"
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      )}
    </BulkUpdateDialog>
  );
}
