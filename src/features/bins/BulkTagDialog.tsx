import { useState } from 'react';
import { Button, Dialog } from '@chakra-ui/react';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { TagInput } from './TagInput';

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
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Add Tags</Dialog.Title>
            <Dialog.Description>
              Add tags to {binIds.length} selected bin{binIds.length !== 1 ? 's' : ''}.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={tags.length === 0 || loading}>
              {loading ? 'Applying...' : 'Apply'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
