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
import { ColorPicker } from './ColorPicker';
import { updateBin } from './useBins';

interface BulkColorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkColorDialog({ open, onOpenChange, binIds, onDone }: BulkColorDialogProps) {
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    setLoading(true);
    try {
      await Promise.all(binIds.map((id) => updateBin(id, { color })));
      setColor('');
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
          <DialogTitle>Change Color</DialogTitle>
          <DialogDescription>
            Set color for {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <ColorPicker value={color} onChange={setColor} />
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
