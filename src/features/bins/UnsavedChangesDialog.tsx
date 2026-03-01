import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ open, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Would you like to save them before leaving?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={onDiscard}
            className="rounded-[var(--radius-full)] text-[var(--destructive)]"
          >
            Discard
          </Button>
          <Button onClick={onSave} className="rounded-[var(--radius-full)]">
            Save &amp; Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
