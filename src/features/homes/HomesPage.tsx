import { useState } from 'react';
import { Home, Plus, LogIn, Users, Crown, Pencil, Trash2 } from 'lucide-react';
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
import { useHomeList, createHome, joinHome, updateHome, deleteHome } from './useHomes';
import { HomeMembersDialog } from './HomeMembersDialog';

export function HomesPage() {
  const { user, setActiveHomeId, activeHomeId } = useAuth();
  const { homes, isLoading } = useHomeList();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [membersHomeId, setMembersHomeId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  // Rename state
  const [renameHomeId, setRenameHomeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete state
  const [deleteHomeId, setDeleteHomeId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteHomeName = homes.find((h) => h.id === deleteHomeId)?.name ?? '';

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const home = await createHome(newName.trim());
      setActiveHomeId(home.id);
      setNewName('');
      setCreateOpen(false);
      showToast({ message: `Created "${home.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create home' });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      const home = await joinHome(inviteCode.trim());
      setActiveHomeId(home.id);
      setInviteCode('');
      setJoinOpen(false);
      showToast({ message: `Joined "${home.name}"` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to join home' });
    } finally {
      setJoining(false);
    }
  }

  function startRename(homeId: string, currentName: string) {
    setRenameHomeId(homeId);
    setRenameValue(currentName);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameHomeId || !renameValue.trim()) return;
    setRenaming(true);
    try {
      await updateHome(renameHomeId, renameValue.trim());
      setRenameHomeId(null);
      showToast({ message: 'Home renamed' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to rename home' });
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    if (!deleteHomeId) return;
    setDeleting(true);
    try {
      await deleteHome(deleteHomeId);
      if (activeHomeId === deleteHomeId) {
        const remaining = homes.filter((h) => h.id !== deleteHomeId);
        setActiveHomeId(remaining.length > 0 ? remaining[0].id : null);
      }
      setDeleteHomeId(null);
      showToast({ message: 'Home deleted' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete home' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-2">
      <div className="flex items-center justify-between">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Homes
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
            aria-label="Create home"
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
      ) : homes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <Home className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">No homes yet</p>
            <p className="text-[13px]">Create a home or join one with an invite code</p>
          </div>
          <div className="flex gap-2.5">
            <Button onClick={() => setJoinOpen(true)} variant="outline" className="rounded-[var(--radius-full)]">
              <LogIn className="h-4 w-4 mr-2" />
              Join Home
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="rounded-[var(--radius-full)]">
              <Plus className="h-4 w-4 mr-2" />
              Create Home
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {homes.map((home) => {
            const isActive = home.id === activeHomeId;
            const isOwner = home.created_by === user?.id || (home as Record<string, unknown>).role === 'owner';
            return (
              <Card
                key={home.id}
                className={isActive ? 'ring-2 ring-[var(--accent)]' : ''}
              >
                <CardContent className="py-4">
                  <button
                    className="w-full text-left"
                    onClick={() => setActiveHomeId(home.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Home className="h-5 w-5 text-[var(--text-secondary)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                            {home.name}
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
                          onClick={() => setMembersHomeId(home.id)}
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
                              onClick={() => startRename(home.id, home.name)}
                              aria-label="Rename home"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 text-[var(--destructive)]"
                              onClick={() => setDeleteHomeId(home.id)}
                              aria-label="Delete home"
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

      {/* Create Home Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Home</DialogTitle>
            <DialogDescription>
              A home is a shared space where members can manage bins together.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="home-name">Name</Label>
              <Input
                id="home-name"
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

      {/* Join Home Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Home</DialogTitle>
            <DialogDescription>
              Enter the invite code shared by a home owner to join.
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

      {/* Rename Home Dialog */}
      <Dialog open={!!renameHomeId} onOpenChange={(open) => !open && setRenameHomeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Home</DialogTitle>
            <DialogDescription>
              Enter a new name for this home.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="rename-home">Name</Label>
              <Input
                id="rename-home"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenameHomeId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renaming}>
                {renaming ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Home Dialog */}
      <Dialog open={!!deleteHomeId} onOpenChange={(open) => !open && setDeleteHomeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Home?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteHomeName}&quot; and all its bins and photos. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteHomeId(null)} className="rounded-[var(--radius-full)]">
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
      {membersHomeId && (
        <HomeMembersDialog
          homeId={membersHomeId}
          open={!!membersHomeId}
          onOpenChange={(open) => !open && setMembersHomeId(null)}
        />
      )}
    </div>
  );
}
