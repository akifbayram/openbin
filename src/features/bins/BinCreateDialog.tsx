import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { addBin, useAllTags as useAllTagsFetch } from './useBins';

interface BinCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillName?: string;
  allTags?: string[];
}

export function BinCreateDialog({ open, onOpenChange, prefillName, allTags: allTagsProp }: BinCreateDialogProps) {
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const t = useTerminology();
  const allTagsFetched = useAllTagsFetch(allTagsProp !== undefined);
  const allTags = allTagsProp ?? allTagsFetched;

  const [loading, setLoading] = useState(false);
  const [aiSetupOpen, setAiSetupOpen] = useState(false);

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
      onOpenChange(false);
      navigate(`/bin/${id}`, { state: { backLabel: t.Bins, backPath: '/bins' } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {t.Bin}</DialogTitle>
            <DialogDescription>Add a new storage {t.bin} to your inventory.</DialogDescription>
          </DialogHeader>
          {activeLocationId && (
            <BinCreateForm
              mode="full"
              locationId={activeLocationId}
              onSubmit={handleSubmit}
              submitting={loading}
              showCancel
              onCancel={() => onOpenChange(false)}
              onAiSetupRedirect={() => setAiSetupOpen(true)}
              prefillName={prefillName}
              allTags={allTags}
            />
          )}
        </DialogContent>
      </Dialog>

      <AiSetupDialog open={aiSetupOpen} onOpenChange={setAiSetupOpen} onNavigate={() => onOpenChange(false)} />
    </>
  );
}
