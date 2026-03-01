import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
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
  const { showToast } = useToast();

  async function handleSave() {
    if (!viewName.trim()) return;
    await saveView({ name: viewName.trim(), searchQuery, sort, filters });
    onOpenChange(false);
    showToast({ message: 'View saved' });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setViewName('');
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
        </DialogHeader>
        <Input
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          placeholder="View name..."
          onKeyDown={(e) => { if (e.key === 'Enter' && viewName.trim()) handleSave(); }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">Cancel</Button>
          <Button onClick={handleSave} disabled={!viewName.trim()} className="rounded-[var(--radius-full)]">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
