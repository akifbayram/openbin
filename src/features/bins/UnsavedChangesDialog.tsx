import { DRAWER_PLACEMENT } from '@/components/ui/provider'
import { Button, Drawer } from '@chakra-ui/react'


interface UnsavedChangesDialogProps {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ open, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  return (
    <Drawer.Root role="alertdialog" placement={DRAWER_PLACEMENT} open={open} onOpenChange={(e) => { if (!e.open) onCancel(); }}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title>Unsaved changes</Drawer.Title>
            <Drawer.Description>
              You have unsaved changes. Would you like to save them before leaving?
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body />
          <Drawer.Footer>
            <Button width="full" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              width="full"
              variant="ghost"
              onClick={onDiscard}
              className="text-red-500 dark:text-red-400"
            >
              Discard
            </Button>
            <Button width="full" onClick={onSave}>
              Save &amp; Leave
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
