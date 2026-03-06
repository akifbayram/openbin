import { Button, Dialog } from '@chakra-ui/react';

interface UnsavedChangesDialogProps {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ open, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onCancel(); }}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Unsaved changes</Dialog.Title>
            <Dialog.Description>
              You have unsaved changes. Would you like to save them before leaving?
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              onClick={onDiscard}
              className="text-[var(--destructive)]"
            >
              Discard
            </Button>
            <Button onClick={onSave}>
              Save &amp; Leave
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
