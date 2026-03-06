import { useState } from 'react';
import { Button, Dialog } from '@chakra-ui/react';
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
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Move to Location</Dialog.Title>
            <Dialog.Description>
              Move {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''} to another location.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <LocationSelectList
              locations={otherLocations}
              value={targetId}
              onChange={setTargetId}
              emptyMessage="No other locations available."
            />
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!targetId || loading}>
              {loading ? 'Moving...' : 'Move'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
