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
import { useTerminology } from '@/lib/terminology';
import { createLocation, joinLocation, updateLocation, deleteLocation, useLocationList } from './useLocations';

interface LocationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationCreateDialog({ open, onOpenChange }: LocationCreateDialogProps) {
  const { setActiveLocationId } = useAuth();
  const t = useTerminology();
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
      showToast({ message: err instanceof Error ? err.message : `Failed to create ${t.location}` });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {t.Location}</DialogTitle>
          <DialogDescription>
            A {t.location} is a shared space where members can manage {t.bins} together.
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || creating} className="rounded-[var(--radius-full)]">
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
  const t = useTerminology();
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
      showToast({ message: err instanceof Error ? err.message : `Failed to join ${t.location}` });
    } finally {
      setJoining(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join {t.Location}</DialogTitle>
          <DialogDescription>
            Enter the invite code shared by a {t.location} owner to join.
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button type="submit" disabled={!inviteCode.trim() || joining} className="rounded-[var(--radius-full)]">
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
  const t = useTerminology();
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
      showToast({ message: `${t.Location} renamed` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : `Failed to rename ${t.location}` });
    } finally {
      setRenaming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {t.Location}</DialogTitle>
          <DialogDescription>
            Enter a new name for this {t.location}.
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || renaming} className="rounded-[var(--radius-full)]">
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
  const t = useTerminology();
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
      showToast({ message: `${t.Location} deleted` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : `Failed to delete ${t.location}` });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {t.Location}?</DialogTitle>
          <DialogDescription>
            This will permanently delete &quot;{locationName}&quot; and all its {t.bins} and photos. This cannot be undone.
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
