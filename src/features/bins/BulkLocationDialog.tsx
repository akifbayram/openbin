import { useState } from 'react';
import { Button, Drawer } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';
import { LocationSelectList } from '@/features/locations/LocationSelectList';
import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import { moveBin } from './useBins';

interface BulkLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkLocationDialog({ open, onOpenChange, binIds, onDone }: BulkLocationDialogProps) {
  const { activeLocationId } = useAuth();
  const { locations } = useLocationList();
  const otherLocations = locations.filter((l) => l.id !== activeLocationId);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    if (!targetId) return;
    setLoading(true);
    try {
      await Promise.all(binIds.map((id) => moveBin(id, targetId)));
      setTargetId(null);
      onOpenChange(false);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement={DRAWER_PLACEMENT}
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title>Move to Location</Drawer.Title>
            <Drawer.Description>
              Move {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''} to another location.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <LocationSelectList
              locations={otherLocations}
              value={targetId}
              onChange={setTargetId}
              emptyMessage="No other locations available."
            />
          </Drawer.Body>
          <Drawer.Footer flexDirection="column">
            <Button width="full" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button width="full" onClick={handleApply} disabled={!targetId || loading}>
              {loading ? 'Moving...' : 'Move'}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
