import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { addBin, useAllTags as useAllTagsFetch } from './useBins';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { compressImage } from '@/features/photos/compressImage';
import { addPhoto } from '@/features/photos/usePhotos';
import { BinCreateForm } from './BinCreateForm';
import type { BinCreateFormData } from './BinCreateForm';

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
        shortCodePrefix: data.shortCodePrefix || undefined,
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

      {/* AI Setup Guidance Dialog */}
      <Dialog open={aiSetupOpen} onOpenChange={setAiSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up AI Analysis</DialogTitle>
            <DialogDescription>
              AI can analyze your {t.bin} photos and suggest names, items, tags, and notes automatically. Connect an AI provider in Settings to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] p-3 space-y-2 text-[13px] text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)]">Supported providers</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />OpenAI (GPT-4o, GPT-4o mini)</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />Anthropic (Claude)</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />Local LLM (OpenAI-compatible)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiSetupOpen(false)} className="rounded-[var(--radius-full)]">
              Later
            </Button>
            <Button
              onClick={() => {
                setAiSetupOpen(false);
                onOpenChange(false);
                navigate('/settings');
              }}
              className="rounded-[var(--radius-full)]"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              Go to Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
