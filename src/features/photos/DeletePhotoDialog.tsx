import { Button, Dialog } from '@chakra-ui/react'


interface DeletePhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeletePhotoDialog({ open, onOpenChange, onConfirm }: DeletePhotoDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger />
        <Dialog.Header>
          <Dialog.Title>Delete photo?</Dialog.Title>
          <Dialog.Description>
            This photo will be permanently deleted. This action cannot be undone.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
        </Dialog.Positioner>
    </Dialog.Root>
  );
}
