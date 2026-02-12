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
import { AreaPicker } from '@/features/areas/AreaPicker';
import { updateBin } from './useBins';
import { useAuth } from '@/lib/auth';

interface BulkAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkAreaDialog({ open, onOpenChange, binIds, onDone }: BulkAreaDialogProps) {
  const { activeLocationId } = useAuth();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    setLoading(true);
    try {
      await Promise.all(
        binIds.map((id) => updateBin(id, { areaId }))
      );
      setAreaId(null);
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
          <DialogTitle>Move to Area</DialogTitle>
          <DialogDescription>
            Assign {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''} to an area.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <AreaPicker
            locationId={activeLocationId ?? undefined}
            value={areaId}
            onChange={setAreaId}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={loading} className="rounded-[var(--radius-full)]">
            {loading ? 'Moving...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
