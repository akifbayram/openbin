import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';
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
        <div className="flex flex-col gap-1.5 py-2">
          {locations.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setTargetId(l.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] text-[15px] transition-colors',
                targetId === l.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'hover:bg-[var(--bg-active)] text-[var(--text-primary)]'
              )}
            >
              {l.name}
            </button>
          ))}
          {locations.length === 0 && (
            <p className="text-[14px] text-[var(--text-tertiary)] text-center py-4">
              No other {t.locations} available
            </p>
          )}
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
