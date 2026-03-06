import { useState } from 'react';
import { Button, Drawer, Input } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';
import { toaster } from '@/components/ui/toaster';
import { saveView } from '@/lib/savedViews';
import type { BinFilters, SortOption } from './useBins';

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  sort: SortOption;
  filters: BinFilters;
}

export function SaveViewDialog({ open, onOpenChange, searchQuery, sort, filters }: SaveViewDialogProps) {
  const [viewName, setViewName] = useState('');

  async function handleSave() {
    if (!viewName.trim()) return;
    await saveView({ name: viewName.trim(), searchQuery, sort, filters });
    onOpenChange(false);
    toaster.create({ description: 'View saved' });
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(e) => {
        if (e.open) setViewName('');
        onOpenChange(e.open);
      }}
      placement={DRAWER_PLACEMENT}
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Title>Save Search</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="View name..."
              onKeyDown={(e) => { if (e.key === 'Enter' && viewName.trim()) handleSave(); }}
            />
          </Drawer.Body>
          <Drawer.Footer flexDirection="column">
            <Button width="full" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button width="full" onClick={handleSave} disabled={!viewName.trim()}>Save</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
