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
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { addBin } from './useBins';
import { useAuth } from '@/lib/auth';

interface BinCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillName?: string;
}

export function BinCreateDialog({ open, onOpenChange, prefillName }: BinCreateDialogProps) {
  const navigate = useNavigate();
  const { activeHomeId } = useAuth();
  const [name, setName] = useState(prefillName ?? '');
  const [location, setLocation] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !activeHomeId) return;
    setLoading(true);
    try {
      const id = await addBin({
        name: name.trim(),
        homeId: activeHomeId,
        items,
        notes: notes.trim(),
        tags,
        location: location.trim(),
        icon,
        color,
      });
      setName('');
      setLocation('');
      setItems([]);
      setNotes('');
      setTags([]);
      setIcon('');
      setColor('');
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
            <Label htmlFor="bin-location">Location</Label>
            <Input
              id="bin-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Garage shelf 3"
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
          <div className="space-y-2">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !activeHomeId || loading}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
