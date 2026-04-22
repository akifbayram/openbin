import { useState } from 'react';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAuth } from '@/lib/auth';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import { pluralizeBins } from './pluralizeBins';
import { updateBin } from './useBins';

interface BulkAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkAreaDialog({ open, onOpenChange, binIds, onDone }: BulkAreaDialogProps) {
  const { activeLocationId } = useAuth();
  const [areaId, setAreaId] = useState<string | null>(null);

  async function apply(ids: string[]) {
    await Promise.all(ids.map((id) => updateBin(id, { areaId })));
    setAreaId(null);
  }

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Move to Area"
      description={`Assign ${pluralizeBins(binIds.length)} to an area.`}
      selectedIds={binIds}
      onApply={apply}
      onApplied={onDone}
      loadingLabel="Moving..."
    >
      <div className="space-y-2">
        <AreaPicker
          locationId={activeLocationId ?? undefined}
          value={areaId}
          onChange={setAreaId}
        />
      </div>
    </BulkUpdateDialog>
  );
}
