import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { BinCreateDialog } from '@/features/bins/BinCreateDialog';
import { BulkActionBar } from '@/features/bins/BulkActionBar';
import { BulkAppearanceDialog } from '@/features/bins/BulkAppearanceDialog';
import { BulkAreaDialog } from '@/features/bins/BulkAreaDialog';
import { BulkCustomFieldsDialog } from '@/features/bins/BulkCustomFieldsDialog';
import { BulkLocationDialog } from '@/features/bins/BulkLocationDialog';
import { BulkTagDialog } from '@/features/bins/BulkTagDialog';
import { BulkVisibilityDialog } from '@/features/bins/BulkVisibilityDialog';
import { DeleteBinDialog } from '@/features/bins/DeleteBinDialog';
import { updateBin } from '@/features/bins/useBins';
import type { BulkDialog } from '@/features/bins/useBulkDialogs';
import type { Terminology } from '@/lib/terminology';
import type { Bin } from '@/types';

interface DashboardDialogsProps {
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  bulk: { isOpen: (d: BulkDialog) => boolean; open: (d: BulkDialog) => void; close: () => void };
  selectedIds: Set<string>;
  clearSelection: () => void;
  allTags: string[];
  selectable: boolean;
  isAdmin: boolean;
  canWrite: boolean;
  bulkDelete: () => Promise<void>;
  bulkPinToggle: () => Promise<void>;
  bulkDuplicate: () => Promise<void>;
  pinLabel: string;
  bins: Bin[];
  t: Terminology;
}

export function DashboardDialogs({
  createOpen, setCreateOpen,
  bulk, selectedIds, clearSelection,
  allTags, selectable, isAdmin, canWrite,
  bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel,
  bins, t,
}: DashboardDialogsProps) {
  const { showToast } = useToast();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<{ icon: string; color: string; card_style: string } | null>(null);

  const handleCopyStyle = useCallback(() => {
    const [id] = selectedIds;
    const bin = bins.find((b) => b.id === id);
    if (!bin) return;
    setCopiedStyle({ icon: bin.icon, color: bin.color, card_style: bin.card_style });
    clearSelection();
    showToast({ message: 'Style copied', variant: 'success' });
  }, [selectedIds, bins, clearSelection, showToast]);

  const handlePasteStyle = useCallback(async () => {
    if (!copiedStyle) return;
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => updateBin(id, { icon: copiedStyle.icon, color: copiedStyle.color, cardStyle: copiedStyle.card_style })));
    clearSelection();
    showToast({ message: `Style applied to ${ids.length} ${ids.length === 1 ? t.bin : t.bins}`, variant: 'success' });
  }, [copiedStyle, selectedIds, clearSelection, showToast, t]);

  return (
    <>
      <BinCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

      {selectable && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          isAdmin={isAdmin}
          canWrite={canWrite}
          onTag={() => bulk.open('tag')}
          onMove={() => bulk.open('area')}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
          onAppearance={() => bulk.open('appearance')}
          onVisibility={() => bulk.open('visibility')}
          onMoveLocation={() => bulk.open('location')}
          onPin={bulkPinToggle}
          onDuplicate={bulkDuplicate}
          pinLabel={pinLabel}
          onCustomFields={() => bulk.open('customFields')}
          onCopyStyle={handleCopyStyle}
          onPasteStyle={handlePasteStyle}
          canCopyStyle={selectedIds.size === 1}
          canPasteStyle={copiedStyle !== null}
        />
      )}
      <BulkTagDialog open={bulk.isOpen('tag')} onOpenChange={(v) => v ? bulk.open('tag') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} allTags={allTags} />
      <BulkAreaDialog open={bulk.isOpen('area')} onOpenChange={(v) => v ? bulk.open('area') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <BulkAppearanceDialog open={bulk.isOpen('appearance')} onOpenChange={(v) => v ? bulk.open('appearance') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <BulkVisibilityDialog open={bulk.isOpen('visibility')} onOpenChange={(v) => v ? bulk.open('visibility') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <BulkCustomFieldsDialog open={bulk.isOpen('customFields')} onOpenChange={(v) => v ? bulk.open('customFields') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <BulkLocationDialog open={bulk.isOpen('location')} onOpenChange={(v) => v ? bulk.open('location') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <DeleteBinDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} binName={`${selectedIds.size} ${selectedIds.size === 1 ? t.bin : t.bins}`} onConfirm={bulkDelete} />
    </>
  );
}
