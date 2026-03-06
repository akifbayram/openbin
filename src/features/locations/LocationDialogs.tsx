import { useEffect, useState } from 'react';
import { Button, Dialog, Input } from '@chakra-ui/react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { createLocation, deleteLocation, joinLocation, updateLocation, useLocationList } from './useLocations';

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
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Create {t.Location}</Dialog.Title>
            <Dialog.Description>
              A {t.location} is a shared space where members can manage {t.bins} together.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
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
            </form>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={(e: React.MouseEvent) => handleSubmit(e as unknown as React.FormEvent)} disabled={!name.trim() || creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
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
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Join {t.Location}</Dialog.Title>
            <Dialog.Description>
              Enter the invite code shared by a {t.location} owner to join.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
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
            </form>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={(e: React.MouseEvent) => handleSubmit(e as unknown as React.FormEvent)} disabled={!inviteCode.trim() || joining}>
              {joining ? 'Joining...' : 'Join'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
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
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Rename {t.Location}</Dialog.Title>
            <Dialog.Description>
              Enter a new name for this {t.location}.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
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
            </form>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={(e: React.MouseEvent) => handleSubmit(e as unknown as React.FormEvent)} disabled={!name.trim() || renaming}>
              {renaming ? 'Saving...' : 'Save'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
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
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Delete {t.Location}?</Dialog.Title>
            <Dialog.Description>
              This will permanently delete &quot;{locationName}&quot; and all its {t.bins} and photos. This cannot be undone.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[var(--destructive)] hover:bg-[var(--destructive-hover)] text-[var(--text-on-accent)]"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
