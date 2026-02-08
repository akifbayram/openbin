import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { ItemsInput } from './ItemsInput';
import { addBin } from './useBins';

interface BinCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillName?: string;
}

export function BinCreateDialog({ open, onOpenChange, prefillName }: BinCreateDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(prefillName ?? '');
  const [items, setItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const id = await addBin(name.trim(), items, notes.trim(), tags);
      setName('');
      setItems([]);
      setNotes('');
      setTags([]);
      onOpenChange(false);
      navigate(`/bin/${id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Bin</DialogTitle>
          <DialogDescription>Add a new storage bin to your inventory.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="bin-name">Name</Label>
            <Input
              id="bin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Holiday Decorations"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Items</Label>
            <ItemsInput items={items} onChange={setItems} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bin-notes">Notes</Label>
            <Textarea
              id="bin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput tags={tags} onChange={setTags} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
