import { useMemo, useState } from 'react';
import { BinPickerList } from '@/components/ui/bin-picker-list';
import { useBinList } from '@/features/bins/useBins';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import type { ItemCheckoutWithContext } from '@/types';

interface BulkReturnToBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkouts: ItemCheckoutWithContext[];
  onApply: (checkoutIds: string[], targetBinId: string, targetBinName: string) => Promise<void>;
}

export function BulkReturnToBinDialog({
  open,
  onOpenChange,
  checkouts,
  onApply,
}: BulkReturnToBinDialogProps) {
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const { bins } = useBinList(undefined, 'name', undefined, !open);
  const targetName = bins.find((b) => b.id === targetId)?.name ?? '';
  const originBinCount = useMemo(
    () => new Set(checkouts.map((c) => c.origin_bin_id)).size,
    [checkouts],
  );

  const ids = checkouts.map((c) => c.id);

  return (
    <BulkUpdateDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setTargetId(null);
          setSearch('');
        }
        onOpenChange(v);
      }}
      title={`Return ${ids.length} item${ids.length === 1 ? '' : 's'} to chosen bin`}
      description={`Items currently span ${originBinCount} bin${originBinCount === 1 ? '' : 's'}. They'll all move to the picked destination.`}
      selectedIds={ids}
      onApply={async (checkoutIds) => {
        if (!targetId) return;
        await onApply(checkoutIds, targetId, targetName);
      }}
      applyDisabled={!targetId}
      applyLabel="Return"
      loadingLabel="Returning..."
    >
      <BinPickerList
        selectedBinId={targetId}
        onSelect={setTargetId}
        search={search}
        onSearchChange={setSearch}
        paused={!open}
      />
    </BulkUpdateDialog>
  );
}
