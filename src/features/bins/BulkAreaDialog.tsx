import { useState } from 'react';
import { Button, Dialog } from '@chakra-ui/react';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAuth } from '@/lib/auth';
import { updateBin } from './useBins';

interface BulkAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkAreaDialog({ open, onOpenChange, binIds, onDone }: BulkAreaDialogProps) {
  const { activeLocationId } = useAuth();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    setLoading(true);
    try {
      await Promise.all(
        binIds.map((id) => updateBin(id, { areaId }))
      );
      setAreaId(null);
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
            <Dialog.Title>Move to Area</Dialog.Title>
            <Dialog.Description>
              Assign {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''} to an area.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <div className="space-y-2">
              <AreaPicker
                locationId={activeLocationId ?? undefined}
                value={areaId}
                onChange={setAreaId}
              />
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={loading}>
              {loading ? 'Moving...' : 'Apply'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
