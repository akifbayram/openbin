import { useState } from 'react';
import { BinPickerList } from '@/components/ui/bin-picker-list';
import { useBinList } from '@/features/bins/useBins';
import { BulkUpdateDialog } from '@/lib/bulk/BulkUpdateDialog';
import { pluralize } from '@/lib/utils';

interface BulkMoveItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onApply: (ids: string[], targetBinId: string, targetBinName: string) => Promise<void>;
}

export function BulkMoveItemsDialog({ open, onOpenChange, selectedIds, onApply }: BulkMoveItemsDialogProps) {
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const { bins } = useBinList(undefined, 'name', undefined, !open);
  const targetName = bins.find((b) => b.id === targetId)?.name ?? '';

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
      title={`Move ${pluralize(selectedIds.length, 'item')}`}
      description="Select a bin to move the items into."
      selectedIds={selectedIds}
      onApply={async (ids) => {
        if (!targetId) return;
        await onApply(ids, targetId, targetName);
      }}
      applyDisabled={!targetId}
      applyLabel="Move"
      loadingLabel="Moving…"
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
