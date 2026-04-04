import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTerminology } from '@/lib/terminology';

interface DeleteBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binName: string;
  onConfirm: () => void | Promise<void>;
}

export function DeleteBinDialog({ open, onOpenChange, binName, onConfirm }: DeleteBinDialogProps) {
  const t = useTerminology();
  const [deleting, setDeleting] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!deleting) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this {t.bin}?</DialogTitle>
          <DialogDescription>
            This will delete &apos;{binName}&apos; and all its photos. You can undo this action briefly after deletion.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? 'Deleting\u2026' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
