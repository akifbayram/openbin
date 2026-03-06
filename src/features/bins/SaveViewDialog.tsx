import { useState } from 'react';
import { Button, Dialog, Input } from '@chakra-ui/react';
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
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (e.open) setViewName('');
        onOpenChange(e.open);
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Save Search</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="View name..."
              onKeyDown={(e) => { if (e.key === 'Enter' && viewName.trim()) handleSave(); }}
            />
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!viewName.trim()}>Save</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
