import { useState } from 'react';
import { Button, Dialog } from '@chakra-ui/react';
import type { BinVisibility } from '@/types';
import { updateBin } from './useBins';
import { VisibilityPicker } from './VisibilityPicker';

interface BulkVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkVisibilityDialog({ open, onOpenChange, binIds, onDone }: BulkVisibilityDialogProps) {
  const [visibility, setVisibility] = useState<BinVisibility>('location');
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    setLoading(true);
    try {
      await Promise.all(binIds.map((id) => updateBin(id, { visibility })));
      setVisibility('location');
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
            <Dialog.Title>Change Visibility</Dialog.Title>
            <Dialog.Description>
              Set visibility for {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
              Non-owned bins set to private will be skipped by the server.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <div className="space-y-2">
              <VisibilityPicker value={visibility} onChange={setVisibility} />
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={loading}>
              {loading ? 'Applying...' : 'Apply'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
