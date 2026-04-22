import { useState } from 'react';
import { LocationSelectList } from '@/features/locations/LocationSelectList';
import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import { pluralizeBins } from './pluralizeBins';
import { moveBin } from './useBins';

interface BulkLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkLocationDialog({ open, onOpenChange, binIds, onDone }: BulkLocationDialogProps) {
  const { activeLocationId } = useAuth();
  const { locations } = useLocationList();
  const otherLocations = locations.filter((l) => l.id !== activeLocationId);
  const [targetId, setTargetId] = useState<string | null>(null);

  async function apply(ids: string[]) {
    if (!targetId) return;
    await Promise.all(ids.map((id) => moveBin(id, targetId)));
    setTargetId(null);
  }

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Move to Location"
      description={`Move ${pluralizeBins(binIds.length)} to another location.`}
      selectedIds={binIds}
      onApply={apply}
      onApplied={onDone}
      applyDisabled={!targetId}
      applyLabel="Move"
      loadingLabel="Moving..."
    >
      <LocationSelectList
        locations={otherLocations}
        value={targetId}
        onChange={setTargetId}
        emptyMessage="No other locations available."
      />
    </BulkUpdateDialog>
  );
}
