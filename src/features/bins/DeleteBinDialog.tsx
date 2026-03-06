import { useTerminology } from '@/lib/terminology';
import { Button, Dialog } from '@chakra-ui/react'


interface DeleteBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binName: string;
  onConfirm: () => void;
}

export function DeleteBinDialog({ open, onOpenChange, binName, onConfirm }: DeleteBinDialogProps) {
  const t = useTerminology();

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger />
        <Dialog.Header>
          <Dialog.Title>Delete this {t.bin}?</Dialog.Title>
          <Dialog.Description>
            This will delete &apos;{binName}&apos; and all its photos. You can undo this action briefly after deletion.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            className="rounded-[var(--radius-full)] bg-red-500 hover:bg-red-600 text-white"
          >
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
        </Dialog.Positioner>
    </Dialog.Root>
  );
}
