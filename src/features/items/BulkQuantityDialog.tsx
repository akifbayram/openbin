import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import type { QuantityOp } from './useItemBulkActions';

const OPTIONS: Array<{ value: QuantityOp; label: string; needsValue: boolean }> = [
  { value: 'set', label: 'Set to', needsValue: true },
  { value: 'clear', label: 'Clear quantity', needsValue: false },
  { value: 'inc', label: 'Increment by', needsValue: true },
  { value: 'dec', label: 'Decrement by', needsValue: true },
];

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
      title={`Update quantity for ${selectedIds.length} item${selectedIds.length === 1 ? '' : 's'}`}
      description={op === 'dec' ? 'Items reaching zero will be removed.' : 'Apply a quantity change to every selected item.'}
      selectedIds={selectedIds}
      onApply={async (ids) => onApply(ids, op, needsValue ? numValue : undefined)}
      applyDisabled={!valueValid}
      applyLabel="Apply"
      loadingLabel="Applying…"
    >
      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-[14px] cursor-pointer">
            <input
              type="radio"
              name="quantity-op"
              value={o.value}
              checked={op === o.value}
              onChange={() => setOp(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
        {needsValue && (
          <div className="space-y-1">
            <Label htmlFor="bulk-qty-input">Value</Label>
            <Input
              id="bulk-qty-input"
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
      </div>
    </BulkUpdateDialog>
  );
}
