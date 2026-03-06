import { DRAWER_PLACEMENT } from '@/components/ui/provider'
import { Button, Drawer } from '@chakra-ui/react'


interface DeletePhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeletePhotoDialog({ open, onOpenChange, onConfirm }: DeletePhotoDialogProps) {
  return (
    <Drawer.Root role="alertdialog" placement={DRAWER_PLACEMENT} open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title>Delete photo?</Drawer.Title>
            <Drawer.Description>
              This photo will be permanently deleted. This action cannot be undone.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body />
          <Drawer.Footer>
            <Button width="full" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              width="full"
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
