import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DeletePhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeletePhotoDialog({ open, onOpenChange, onConfirm }: DeletePhotoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete photo?</DialogTitle>
          <DialogDescription>
            This photo will be permanently deleted. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:bg-[var(--destructive-hover)] text-[var(--text-on-accent)]"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
