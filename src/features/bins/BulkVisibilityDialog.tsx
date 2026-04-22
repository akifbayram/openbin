import { useState } from 'react';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import type { BinVisibility } from '@/types';
import { pluralizeBins } from './pluralizeBins';
import { updateBin } from './useBins';
import { VisibilityPicker } from './VisibilityPicker';

interface BulkVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkVisibilityDialog({ open, onOpenChange, binIds, onDone }: BulkVisibilityDialogProps) {
  const [visibility, setVisibility] = useState<BinVisibility>('location');

  async function apply(ids: string[]) {
    await Promise.all(ids.map((id) => updateBin(id, { visibility })));
    setVisibility('location');
  }

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change Visibility"
      description={`Set visibility for ${pluralizeBins(binIds.length)}. Non-owned bins set to private will be skipped by the server.`}
      selectedIds={binIds}
      onApply={apply}
      onApplied={onDone}
    >
      <div className="space-y-2">
        <VisibilityPicker value={visibility} onChange={setVisibility} />
      </div>
    </BulkUpdateDialog>
  );
}
