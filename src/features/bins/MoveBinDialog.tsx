import { useState } from 'react';
import { Button, Dialog } from '@chakra-ui/react';
import { LocationSelectList } from '@/features/locations/LocationSelectList';
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
    <Dialog.Root open={open} onOpenChange={(e) => handleOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Move to another {t.location}</Dialog.Title>
            <Dialog.Description>
              Select a {t.location} to move the &apos;{binName}&apos; {t.bin}.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <div className="py-2">
              <LocationSelectList
                locations={locations}
                value={targetId}
                onChange={setTargetId}
                emptyMessage={`No other ${t.locations} available`}
              />
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => { if (targetId) onConfirm(targetId); }}
              disabled={!targetId}
            >
              Move
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
