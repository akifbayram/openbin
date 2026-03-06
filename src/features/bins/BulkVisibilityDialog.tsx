import { useState } from 'react';
import { Button, Drawer } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';
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
            <Drawer.Title>Change Visibility</Drawer.Title>
            <Drawer.Description>
              Set visibility for {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
              Non-owned bins set to private will be skipped by the server.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-2">
              <VisibilityPicker value={visibility} onChange={setVisibility} />
            </div>
          </Drawer.Body>
          <Drawer.Footer flexDirection="column">
            <Button width="full" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button width="full" onClick={handleApply} disabled={loading}>
              {loading ? 'Applying...' : 'Apply'}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
