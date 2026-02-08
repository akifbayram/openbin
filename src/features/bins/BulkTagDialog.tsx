import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TagInput } from './TagInput';
import { db } from '@/db';

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
}

export function BulkTagDialog({ open, onOpenChange, binIds, onDone }: BulkTagDialogProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    if (tags.length === 0) return;
    setLoading(true);
    try {
      await db.transaction('rw', db.bins, async () => {
        for (const id of binIds) {
          const bin = await db.bins.get(id);
          if (!bin) continue;
          const merged = [...new Set([...bin.tags, ...tags])];
          await db.bins.update(id, { tags: merged, updatedAt: new Date() });
        }
      });
      setTags([]);
      onOpenChange(false);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tags</DialogTitle>
          <DialogDescription>
            Add tags to {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Tags</Label>
          <TagInput tags={tags} onChange={setTags} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={tags.length === 0 || loading}>
            {loading ? 'Applying...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
