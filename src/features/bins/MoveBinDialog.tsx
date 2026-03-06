import { useState } from 'react';
import { Button, Drawer } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';
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
    <Drawer.Root open={open} onOpenChange={(e) => handleOpenChange(e.open)} placement={DRAWER_PLACEMENT}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title>Move to another {t.location}</Drawer.Title>
            <Drawer.Description>
              Select a {t.location} to move the &apos;{binName}&apos; {t.bin}.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="py-2">
              <LocationSelectList
                locations={locations}
                value={targetId}
                onChange={setTargetId}
                emptyMessage={`No other ${t.locations} available`}
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer flexDirection="column">
            <Button width="full" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              width="full"
              onClick={() => { if (targetId) onConfirm(targetId); }}
              disabled={!targetId}
            >
              Move
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
