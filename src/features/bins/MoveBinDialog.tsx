import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useTerminology } from '@/lib/terminology';
import { LocationSelectList } from '@/features/locations/LocationSelectList';
import type { Location } from '@/types';

interface MoveBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binName: string;
  locations: Location[];
  onConfirm: (locationId: string) => void;
}

export function MoveBinDialog({ open, onOpenChange, binName, locations, onConfirm }: MoveBinDialogProps) {
  const t = useTerminology();
  const [targetId, setTargetId] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setTargetId(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to another {t.location}</DialogTitle>
          <DialogDescription>
            Select a {t.location} to move the &apos;{binName}&apos; {t.bin}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <LocationSelectList
            locations={locations}
            value={targetId}
            onChange={setTargetId}
            emptyMessage={`No other ${t.locations} available`}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button
            onClick={() => { if (targetId) onConfirm(targetId); }}
            disabled={!targetId}
            className="rounded-[var(--radius-full)]"
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
