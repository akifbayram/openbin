import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { VisibilityPicker } from './VisibilityPicker';
import { updateBin } from './useBins';
import type { BinVisibility } from '@/types';

interface BulkVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkVisibilityDialog({ open, onOpenChange, binIds, onDone }: BulkVisibilityDialogProps) {
  const [visibility, setVisibility] = useState<BinVisibility>('location');
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    setLoading(true);
    try {
      await Promise.all(binIds.map((id) => updateBin(id, { visibility })));
      setVisibility('location');
      onOpenChange(false);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Visibility</DialogTitle>
          <DialogDescription>
            Set visibility for {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
            Non-owned bins set to private will be skipped by the server.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <VisibilityPicker value={visibility} onChange={setVisibility} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={loading} className="rounded-[var(--radius-full)]">
            {loading ? 'Applying...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
