import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TagEntry } from './useTags';

interface BulkDeleteTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: string[];
  binsAffected: number;
  onConfirm: () => Promise<void>;
}

export function BulkDeleteTagsDialog({ open, onOpenChange, tags, binsAffected, onConfirm }: BulkDeleteTagsDialogProps) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }
  const preview =
    tags.slice(0, 5).map((t) => `"${t}"`).join(', ') + (tags.length > 5 ? `, +${tags.length - 5} more` : '');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {tags.length} tag{tags.length === 1 ? '' : 's'}?
          </DialogTitle>
          <DialogDescription>
            Removes {preview} from this location. ~{binsAffected} bin{binsAffected === 1 ? '' : 's'} will be updated. Children become top-level.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handle} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Caller passes the tag list — sums their bin counts to a single number for the dialog copy. */
export function sumBinCounts(allTags: TagEntry[], selectedTagNames: string[]): number {
  const sel = new Set(selectedTagNames);
  return allTags.reduce((sum, t) => (sel.has(t.tag) ? sum + t.count : sum), 0);
}
