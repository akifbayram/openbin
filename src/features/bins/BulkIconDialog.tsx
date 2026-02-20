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
import { IconPicker } from './IconPicker';
import { updateBin } from './useBins';

interface BulkIconDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkIconDialog({ open, onOpenChange, binIds, onDone }: BulkIconDialogProps) {
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    setLoading(true);
    try {
      await Promise.all(binIds.map((id) => updateBin(id, { icon })));
      setIcon('');
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
          <DialogTitle>Change Icon</DialogTitle>
          <DialogDescription>
            Set icon for {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <IconPicker value={icon} onChange={setIcon} />
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
