import { useTerminology } from '@/lib/terminology';
import { DRAWER_PLACEMENT } from '@/components/ui/provider'
import { Button, Drawer } from '@chakra-ui/react'


interface DeleteBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binName: string;
  onConfirm: () => void;
}

export function DeleteBinDialog({ open, onOpenChange, binName, onConfirm }: DeleteBinDialogProps) {
  const t = useTerminology();

  return (
    <Drawer.Root role="alertdialog" placement={DRAWER_PLACEMENT} open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title>Delete this {t.bin}?</Drawer.Title>
            <Drawer.Description>
              This will delete &apos;{binName}&apos; and all its photos. You can undo this action briefly after deletion.
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
