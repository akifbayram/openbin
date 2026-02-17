import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { createLocation, joinLocation, updateLocation, deleteLocation, useLocationList } from './useLocations';

interface LocationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationCreateDialog({ open, onOpenChange }: LocationCreateDialogProps) {
  const { setActiveLocationId } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setCreating(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const location = await createLocation(name.trim());
      setActiveLocationId(location.id);
      onOpenChange(false);
      showToast({ message: `Created "${location.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create location' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Location</DialogTitle>
          <DialogDescription>
            A location is a shared space where members can manage bins together.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="location-name">Name</Label>
            <Input
              id="location-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My House, Office"
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface LocationJoinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationJoinDialog({ open, onOpenChange }: LocationJoinDialogProps) {
  const { setActiveLocationId } = useAuth();
  const { showToast } = useToast();
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (open) {
      setInviteCode('');
      setJoining(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      const location = await joinLocation(inviteCode.trim());
      setActiveLocationId(location.id);
      onOpenChange(false);
      showToast({ message: `Joined "${location.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to join location' });
    } finally {
      setJoining(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Location</DialogTitle>
          <DialogDescription>
            Enter the invite code shared by a location owner to join.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!inviteCode.trim() || joining}>
              {joining ? 'Joining...' : 'Join'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface LocationRenameDialogProps {
  locationId: string | null;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationRenameDialog({ locationId, currentName, open, onOpenChange }: LocationRenameDialogProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(currentName);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setRenaming(false);
    }
  }, [open, currentName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId || !name.trim()) return;
    setRenaming(true);
    try {
      await updateLocation(locationId, { name: name.trim() });
      onOpenChange(false);
      showToast({ message: 'Location renamed' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to rename location' });
    } finally {
      setRenaming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Location</DialogTitle>
          <DialogDescription>
            Enter a new name for this location.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="rename-location">Name</Label>
            <Input
              id="rename-location"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || renaming}>
              {renaming ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface LocationDeleteDialogProps {
  locationId: string | null;
  locationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationDeleteDialog({ locationId, locationName, open, onOpenChange }: LocationDeleteDialogProps) {
  const { activeLocationId, setActiveLocationId } = useAuth();
  const { locations } = useLocationList();
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!locationId) return;
    setDeleting(true);
    try {
      await deleteLocation(locationId);
      if (activeLocationId === locationId) {
        const remaining = locations.filter((h) => h.id !== locationId);
        setActiveLocationId(remaining.length > 0 ? remaining[0].id : null);
      }
      onOpenChange(false);
      showToast({ message: 'Location deleted' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete location' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Location?</DialogTitle>
          <DialogDescription>
            This will permanently delete &quot;{locationName}&quot; and all its bins and photos. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:bg-[var(--destructive-hover)] text-[var(--text-on-accent)]"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
