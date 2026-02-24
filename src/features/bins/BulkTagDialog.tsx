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
import { apiFetch } from '@/lib/api';

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binIds: string[];
  onDone: () => void;
  allTags: string[];
}

export function BulkTagDialog({ open, onOpenChange, binIds, onDone, allTags }: BulkTagDialogProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    if (tags.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(
        binIds.map((id) =>
          apiFetch(`/api/bins/${id}/add-tags`, {
            method: 'PUT',
            body: { tags },
          }).catch(() => {
            // If add-tags endpoint doesn't exist, fall back to fetching the bin and updating
            return apiFetch<{ tags: string[] }>(`/api/bins/${id}`).then((bin) => {
              const merged = [...new Set([...bin.tags, ...tags])];
              return apiFetch(`/api/bins/${id}`, {
                method: 'PUT',
                body: { tags: merged },
              });
            });
          })
        )
      );
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
          <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={tags.length === 0 || loading} className="rounded-[var(--radius-full)]">
            {loading ? 'Applying...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
