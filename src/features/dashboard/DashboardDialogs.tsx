import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { BulkActionBar } from '@/features/bins/BulkActionBar';
import { updateBin } from '@/features/bins/useBins';
import type { BulkDialog } from '@/features/bins/useBulkDialogs';
import type { Terminology } from '@/lib/terminology';
import type { Bin } from '@/types';

const BinCreateDialog = lazy(() =>
  import('@/features/bins/BinCreateDialog').then((m) => ({ default: m.BinCreateDialog })),
);
const BulkAppearanceDialog = lazy(() =>
  import('@/features/bins/BulkAppearanceDialog').then((m) => ({ default: m.BulkAppearanceDialog })),
);
const BulkAreaDialog = lazy(() =>
  import('@/features/bins/BulkAreaDialog').then((m) => ({ default: m.BulkAreaDialog })),
);
const BulkCustomFieldsDialog = lazy(() =>
  import('@/features/bins/BulkCustomFieldsDialog').then((m) => ({ default: m.BulkCustomFieldsDialog })),
);
const BulkLocationDialog = lazy(() =>
  import('@/features/bins/BulkLocationDialog').then((m) => ({ default: m.BulkLocationDialog })),
);
const BulkTagDialog = lazy(() =>
  import('@/features/bins/BulkTagDialog').then((m) => ({ default: m.BulkTagDialog })),
);
const BulkVisibilityDialog = lazy(() =>
  import('@/features/bins/BulkVisibilityDialog').then((m) => ({ default: m.BulkVisibilityDialog })),
);
const DeleteBinDialog = lazy(() =>
  import('@/features/bins/DeleteBinDialog').then((m) => ({ default: m.DeleteBinDialog })),
);

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
  isBusy?: boolean;
  bins: Bin[];
  t: Terminology;
}

export function DashboardDialogs({
  createOpen, setCreateOpen,
  bulk, selectedIds, clearSelection,
  allTags, selectable, isAdmin, canWrite,
  bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel, isBusy,
  bins, t,
}: DashboardDialogsProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<{ icon: string; color: string; card_style: string } | null>(null);

  // Mount each lazy dialog only after it has been opened at least once.
  // Keep it mounted thereafter so exit/close animations can play out.
  const createMounted = useRef(false);
  if (createOpen) createMounted.current = true;

  const tagMounted = useRef(false);
  if (bulk.isOpen('tag')) tagMounted.current = true;
  const areaMounted = useRef(false);
  if (bulk.isOpen('area')) areaMounted.current = true;
  const appearanceMounted = useRef(false);
  if (bulk.isOpen('appearance')) appearanceMounted.current = true;
  const visibilityMounted = useRef(false);
  if (bulk.isOpen('visibility')) visibilityMounted.current = true;
  const customFieldsMounted = useRef(false);
  if (bulk.isOpen('customFields')) customFieldsMounted.current = true;
  const locationMounted = useRef(false);
  if (bulk.isOpen('location')) locationMounted.current = true;
  const deleteMounted = useRef(false);
  if (bulkDeleteOpen) deleteMounted.current = true;

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
      {createMounted.current && (
        <Suspense fallback={null}>
          <BinCreateDialog open={createOpen} onOpenChange={setCreateOpen} allTags={allTags} />
        </Suspense>
      )}

      {selectable && (
        <>
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
            isBusy={isBusy}
            onPrint={() => navigate(`/print?ids=${[...selectedIds].join(',')}`)}
          />
          {tagMounted.current && (
            <Suspense fallback={null}>
              <BulkTagDialog open={bulk.isOpen('tag')} onOpenChange={(v) => v ? bulk.open('tag') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} allTags={allTags} />
            </Suspense>
          )}
          {areaMounted.current && (
            <Suspense fallback={null}>
              <BulkAreaDialog open={bulk.isOpen('area')} onOpenChange={(v) => v ? bulk.open('area') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
            </Suspense>
          )}
          {appearanceMounted.current && (
            <Suspense fallback={null}>
              <BulkAppearanceDialog open={bulk.isOpen('appearance')} onOpenChange={(v) => v ? bulk.open('appearance') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
            </Suspense>
          )}
          {visibilityMounted.current && (
            <Suspense fallback={null}>
              <BulkVisibilityDialog open={bulk.isOpen('visibility')} onOpenChange={(v) => v ? bulk.open('visibility') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
            </Suspense>
          )}
          {customFieldsMounted.current && (
            <Suspense fallback={null}>
              <BulkCustomFieldsDialog open={bulk.isOpen('customFields')} onOpenChange={(v) => v ? bulk.open('customFields') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
            </Suspense>
          )}
          {locationMounted.current && (
            <Suspense fallback={null}>
              <BulkLocationDialog open={bulk.isOpen('location')} onOpenChange={(v) => v ? bulk.open('location') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
            </Suspense>
          )}
          {deleteMounted.current && (
            <Suspense fallback={null}>
              <DeleteBinDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} binName={`${selectedIds.size} ${selectedIds.size === 1 ? t.bin : t.bins}`} onConfirm={bulkDelete} />
            </Suspense>
          )}
        </>
      )}
    </>
  );
}
