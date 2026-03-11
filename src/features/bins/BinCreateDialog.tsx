import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AiSetupDialog } from '@/features/ai/AiSetupDialog';
import { compressImage } from '@/features/photos/compressImage';
import { addPhoto } from '@/features/photos/usePhotos';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import type { BinCreateFormData } from './BinCreateForm';
import { BinCreateForm } from './BinCreateForm';
import type { CreatedBinInfo } from './BinCreateSuccess';
import { BinCreateSuccess } from './BinCreateSuccess';
import { addBin, useAllTags as useAllTagsFetch } from './useBins';

interface BinCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillName?: string;
  allTags?: string[];
}

export function BinCreateDialog({ open, onOpenChange, prefillName, allTags: allTagsProp }: BinCreateDialogProps) {
  const { activeLocationId } = useAuth();
  const t = useTerminology();
  const allTagsFetched = useAllTagsFetch(allTagsProp !== undefined);
  const allTags = allTagsProp ?? allTagsFetched;

  const [loading, setLoading] = useState(false);
  const [aiSetupOpen, setAiSetupOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<CreatedBinInfo[] | null>(null);

  // Reset success state when dialog opens (not on close, to avoid flash during exit animation)
  useEffect(() => {
    if (open) setSuccessInfo(null);
  }, [open]);

  function handleOpenChange(open: boolean) {
    onOpenChange(open);
  }

  async function handleSubmit(data: BinCreateFormData) {
    if (!activeLocationId) return;
    setLoading(true);
    try {
      const { id } = await addBin({
        name: data.name,
        locationId: activeLocationId,
        items: data.items,
        notes: data.notes,
        tags: data.tags,
        areaId: data.areaId,
        icon: data.icon,
        color: data.color,
        cardStyle: data.cardStyle || undefined,
        visibility: data.visibility,
        customFields: data.customFields,
      });
      // Upload photos non-blocking (fire-and-forget)
      if (data.photos.length > 0) {
        Promise.all(
          data.photos.map((p) =>
            compressImage(p)
              .then((compressed) => addPhoto(id, compressed instanceof File
                ? compressed
                : new File([compressed], p.name, { type: compressed.type || 'image/jpeg' })))
              .catch(() => { /* photo upload is non-blocking */ })
          )
        ).catch(() => { /* ignore */ });
      }
      setSuccessInfo([{
        id,
        name: data.name,
        icon: data.icon,
        color: data.color,
        itemCount: data.items.length,
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            {!successInfo && <DialogTitle>New {t.Bin}</DialogTitle>}
            {!successInfo && (
              <DialogDescription>Add a new storage {t.bin} to your inventory.</DialogDescription>
            )}
          </DialogHeader>
          {activeLocationId && (
            successInfo ? (
              <BinCreateSuccess
                createdBins={successInfo}
                onCreateAnother={() => setSuccessInfo(null)}
                onClose={() => handleOpenChange(false)}
              />
            ) : (
              <BinCreateForm
                mode="full"
                locationId={activeLocationId}
                onSubmit={handleSubmit}
                submitting={loading}
                showCancel
                onCancel={() => handleOpenChange(false)}
                onAiSetupRedirect={() => setAiSetupOpen(true)}
                prefillName={prefillName}
                allTags={allTags}
              />
            )
          )}
        </DialogContent>
      </Dialog>

      <AiSetupDialog open={aiSetupOpen} onOpenChange={setAiSetupOpen} onNavigate={() => handleOpenChange(false)} />
    </>
  );
}
