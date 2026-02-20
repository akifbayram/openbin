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
import { useLocationList } from '@/features/locations/useLocations';
import { moveBin } from './useBins';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface BulkLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkLocationDialog({ open, onOpenChange, binIds, onDone }: BulkLocationDialogProps) {
  const { activeLocationId } = useAuth();
  const { locations } = useLocationList();
  const otherLocations = locations.filter((l) => l.id !== activeLocationId);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    if (!targetId) return;
    setLoading(true);
    try {
      await Promise.all(binIds.map((id) => moveBin(id, targetId)));
      setTargetId(null);
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
          <DialogTitle>Move to Location</DialogTitle>
          <DialogDescription>
            Move {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''} to another location.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {otherLocations.length === 0 ? (
            <p className="text-[13px] text-[var(--text-tertiary)] py-4 text-center">
              No other locations available.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {otherLocations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setTargetId(loc.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] transition-colors',
                    targetId === loc.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  )}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!targetId || loading} className="rounded-[var(--radius-full)]">
            {loading ? 'Moving...' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
