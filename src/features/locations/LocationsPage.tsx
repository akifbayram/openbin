import { useState } from 'react';
import { MapPin, Plus, LogIn, Users, Crown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useLocationList, createLocation, joinLocation, updateLocation, deleteLocation } from './useLocations';
import { LocationMembersDialog } from './LocationMembersDialog';

export function LocationsPage() {
  const { user, setActiveLocationId, activeLocationId } = useAuth();
  const { locations, isLoading } = useLocationList();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [membersLocationId, setMembersLocationId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  // Rename state
  const [renameLocationId, setRenameLocationId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete state
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteLocationName = locations.find((h) => h.id === deleteLocationId)?.name ?? '';

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const location = await createLocation(newName.trim());
      setActiveLocationId(location.id);
      setNewName('');
      setCreateOpen(false);
      showToast({ message: `Created "${location.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create location' });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      const location = await joinLocation(inviteCode.trim());
      setActiveLocationId(location.id);
      setInviteCode('');
      setJoinOpen(false);
      showToast({ message: `Joined "${location.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to join location' });
    } finally {
      setJoining(false);
    }
  }

  function startRename(locationId: string, currentName: string) {
    setRenameLocationId(locationId);
    setRenameValue(currentName);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameLocationId || !renameValue.trim()) return;
    setRenaming(true);
    try {
      await updateLocation(renameLocationId, renameValue.trim());
      setRenameLocationId(null);
      showToast({ message: 'Location renamed' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to rename location' });
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    if (!deleteLocationId) return;
    setDeleting(true);
    try {
      await deleteLocation(deleteLocationId);
      if (activeLocationId === deleteLocationId) {
        const remaining = locations.filter((h) => h.id !== deleteLocationId);
        setActiveLocationId(remaining.length > 0 ? remaining[0].id : null);
      }
      setDeleteLocationId(null);
      showToast({ message: 'Location deleted' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete location' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-2 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Locations
        </h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setJoinOpen(true)}
            className="rounded-[var(--radius-full)] h-10 px-3.5"
          >
            <LogIn className="h-4 w-4 mr-1.5" />
            Join
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Create location"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <MapPin className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">No locations yet</p>
            <p className="text-[13px]">Create a location or join one with an invite code</p>
          </div>
          <div className="flex gap-2.5">
            <Button onClick={() => setJoinOpen(true)} variant="outline" className="rounded-[var(--radius-full)]">
              <LogIn className="h-4 w-4 mr-2" />
              Join Location
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="rounded-[var(--radius-full)]">
              <Plus className="h-4 w-4 mr-2" />
              Create Location
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => {
            const isActive = loc.id === activeLocationId;
            const isOwner = loc.created_by === user?.id || (loc as Record<string, unknown>).role === 'owner';
            return (
              <Card
                key={loc.id}
                className={isActive ? 'ring-2 ring-[var(--accent)]' : ''}
              >
                <CardContent className="py-4">
                  <button
                    className="w-full text-left"
                    onClick={() => setActiveLocationId(loc.id)}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-[var(--text-secondary)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                            {loc.name}
                          </span>
                          {isOwner && (
                            <Badge variant="secondary" className="text-[11px] gap-1 py-0">
                              <Crown className="h-3 w-3" />
                              Owner
                            </Badge>
                          )}
                          {isActive && (
                            <Badge className="text-[11px] py-0">Active</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-[var(--radius-full)] h-8 px-3"
                          onClick={() => setMembersLocationId(loc.id)}
                        >
                          <Users className="h-3.5 w-3.5 mr-1.5" />
                          Members
                        </Button>
                        {isOwner && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8"
                              onClick={() => startRename(loc.id, loc.name)}
                              aria-label="Rename location"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 text-[var(--destructive)]"
                              onClick={() => setDeleteLocationId(loc.id)}
                              aria-label="Delete location"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Location Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Location</DialogTitle>
            <DialogDescription>
              A location is a shared space where members can manage bins together.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="location-name">Name</Label>
              <Input
                id="location-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., My House, Office"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newName.trim() || creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Join Location Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Location</DialogTitle>
            <DialogDescription>
              Enter the invite code shared by a location owner to join.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoin} className="space-y-5">
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
              <Button type="button" variant="ghost" onClick={() => setJoinOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!inviteCode.trim() || joining}>
                {joining ? 'Joining...' : 'Join'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Location Dialog */}
      <Dialog open={!!renameLocationId} onOpenChange={(open) => !open && setRenameLocationId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Location</DialogTitle>
            <DialogDescription>
              Enter a new name for this location.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="rename-location">Name</Label>
              <Input
                id="rename-location"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenameLocationId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renaming}>
                {renaming ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Location Dialog */}
      <Dialog open={!!deleteLocationId} onOpenChange={(open) => !open && setDeleteLocationId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteLocationName}&quot; and all its bins and photos. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteLocationId(null)} className="rounded-[var(--radius-full)]">
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

      {/* Members Dialog */}
      {membersLocationId && (
        <LocationMembersDialog
          locationId={membersLocationId}
          open={!!membersLocationId}
          onOpenChange={(open) => !open && setMembersLocationId(null)}
        />
      )}
    </div>
  );
}
