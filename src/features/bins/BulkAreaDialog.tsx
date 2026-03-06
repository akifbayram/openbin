import { useState } from 'react';
import { Button, Drawer } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';
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
            <Drawer.Title>Move to Area</Drawer.Title>
            <Drawer.Description>
              Assign {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''} to an area.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-2">
              <AreaPicker
                locationId={activeLocationId ?? undefined}
                value={areaId}
                onChange={setAreaId}
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer flexDirection="column">
            <Button width="full" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button width="full" onClick={handleApply} disabled={loading}>
              {loading ? 'Moving...' : 'Apply'}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
