import { Check, Copy, LogIn, MapPin, MapPinned, Plus, Shield, User, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { LocationCreateDialog, LocationDeleteDialog, LocationJoinDialog, LocationRenameDialog } from '@/features/locations/LocationDialogs';
import { LocationMembersDialog } from '@/features/locations/LocationMembersDialog';
import { LocationRetentionDialog } from '@/features/locations/LocationRetentionDialog';
import { leaveLocation, useLocationList } from '@/features/locations/useLocations';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { AreaCard, CreateAreaCard, UnassignedAreaCard } from './AreaCard';
import { LocationSettingsMenu } from './LocationSettingsMenu';
import { LocationTabs } from './LocationTabs';
import { createArea, deleteArea, updateArea, useAreaList } from './useAreas';

interface DeleteAreaTarget {
  id: string;
  name: string;
  binCount: number;
}

export function AreasPage() {
  const t = useTerminology();
  const navigate = useNavigate();
  const { user, activeLocationId, setActiveLocationId } = useAuth();
  const { locations, isLoading: locationsLoading } = useLocationList();
  const { showToast } = useToast();
  const { areas, unassignedCount } = useAreaList(activeLocationId);

  // Location dialog state
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [joinLocationOpen, setJoinLocationOpen] = useState(false);
  const [membersLocationId, setMembersLocationId] = useState<string | null>(null);
  const [renameLocationId, setRenameLocationId] = useState<string | null>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [retentionLocationId, setRetentionLocationId] = useState<string | null>(null);

  // Create area state
  const [createAreaOpen, setCreateAreaOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [creatingArea, setCreatingArea] = useState(false);

  // Delete area state
  const [deleteTarget, setDeleteTarget] = useState<DeleteAreaTarget | null>(null);
  const [deletingArea, setDeletingArea] = useState(false);

  // Invite code copy state
  const [copied, setCopied] = useState(false);

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const isAdmin = activeLocation?.role === 'admin';

  async function handleCopyInvite() {
    if (!activeLocation?.invite_code) return;
    try {
      await navigator.clipboard.writeText(activeLocation.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy' });
    }
  }

  function handleAreaClick(areaId: string) {
    navigate(`/bins?areas=${encodeURIComponent(areaId)}`);
  }

  function handleUnassignedClick() {
    navigate('/bins?areas=__unassigned__');
  }

  async function handleCreateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!newAreaName.trim() || !activeLocationId) return;
    setCreatingArea(true);
    try {
      await createArea(activeLocationId, newAreaName.trim());
      setNewAreaName('');
      setCreateAreaOpen(false);
    } catch (err) {
      showToast({ message: err instanceof ApiError && err.status === 409 ? `${t.Area} name already exists` : 'Something went wrong' });
    } finally {
      setCreatingArea(false);
    }
  }

  async function handleRenameArea(areaId: string, newName: string) {
    if (!activeLocationId) return;
    try {
      await updateArea(activeLocationId, areaId, newName);
    } catch (err) {
      showToast({ message: err instanceof ApiError && err.status === 409 ? `${t.Area} name already exists` : 'Something went wrong' });
      throw err;
    }
  }

  function handleDeleteAreaRequest(areaId: string, name: string, binCount: number) {
    setDeleteTarget({ id: areaId, name, binCount });
  }

  async function handleDeleteArea() {
    if (!deleteTarget || !activeLocationId) return;
    setDeletingArea(true);
    try {
      await deleteArea(activeLocationId, deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      showToast({ message: 'Something went wrong' });
    } finally {
      setDeletingArea(false);
    }
  }

  async function handleLeave(locationId: string) {
    if (!user) return;
    try {
      await leaveLocation(locationId, user.id);
      if (activeLocationId === locationId) {
        const other = locations.find((l) => l.id !== locationId);
        setActiveLocationId(other?.id ?? null);
      }
      showToast({ message: 'Left location' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to leave' });
    }
  }

  const memberCount = activeLocation?.member_count ?? 0;

  return (
    <div className="page-content">
      {/* Header */}
      <PageHeader
        title={locations.length === 1 ? activeLocation?.name ?? t.Locations : t.Locations}
        actions={locations.length > 0 ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setJoinLocationOpen(true)}
              className="rounded-[var(--radius-full)] h-10 px-3.5"
            >
              <LogIn className="h-4 w-4 mr-1.5" />
              Join
            </Button>
            <Button
              onClick={() => setCreateLocationOpen(true)}
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label={`Create ${t.location}`}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        ) : undefined}
      />

      <Crossfade
        isLoading={locationsLoading}
        skeleton={
          <div className="flex flex-col gap-4">
            {/* Meta line skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-1" />
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Area grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-[var(--radius-lg)] p-4 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          </div>
        }
      >
        {/* Empty state — no locations */}
        {locations.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No locations yet"
            subtitle="Create a location or join one with an invite code"
          >
            <div className="flex gap-2.5">
              <Button onClick={() => setJoinLocationOpen(true)} variant="outline" className="rounded-[var(--radius-full)]">
                <LogIn className="h-4 w-4 mr-2" />
                Join Location
              </Button>
              <Button onClick={() => setCreateLocationOpen(true)} className="rounded-[var(--radius-full)]">
                <Plus className="h-4 w-4 mr-2" />
                Create Location
              </Button>
            </div>
          </EmptyState>
        )}

        {/* Active location content */}
        {activeLocation && (
          <>
            {/* Location tabs — only if 2+ locations */}
            {locations.length >= 2 && (
              <LocationTabs
                locations={locations}
                activeId={activeLocationId}
                onSelect={setActiveLocationId}
              />
            )}

            {/* Location info card */}
            <div className="glass-card rounded-[var(--radius-lg)] p-4 animate-fade-in-up">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-1 rounded-[var(--radius-full)] ${isAdmin ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'}`}>
                      {isAdmin ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {isAdmin ? 'Admin' : 'Member'}
                    </span>
                  </div>
                  <span className="text-[var(--text-tertiary)] opacity-30 shrink-0">&middot;</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                    onClick={() => setMembersLocationId(activeLocation.id)}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{memberCount} {memberCount !== 1 ? 'members' : 'member'}</span>
                    <span className="sm:hidden">{memberCount}</span>
                  </button>
                  {activeLocation.invite_code && isAdmin && (
                    <>
                      <span className="text-[var(--text-tertiary)] opacity-30 shrink-0">&middot;</span>
                      <button
                        type="button"
                        onClick={handleCopyInvite}
                        className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer min-w-0"
                        title="Copy invite code"
                      >
                        {copied
                          ? <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                          : <Copy className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{activeLocation.invite_code}</span>
                      </button>
                    </>
                  )}
                </div>
                <LocationSettingsMenu
                  compact
                  isAdmin={isAdmin}
                  onRename={() => setRenameLocationId(activeLocation.id)}
                  onRetention={() => setRetentionLocationId(activeLocation.id)}
                  onDelete={() => setDeleteLocationId(activeLocation.id)}
                  onLeave={() => handleLeave(activeLocation.id)}
                />
              </div>
            </div>

            {/* Area grid */}
            {areas.length === 0 && unassignedCount === 0 ? (
              <EmptyState
                icon={MapPinned}
                title={`No ${t.areas} yet`}
                subtitle={isAdmin ? `Create ${t.areas} to organize your ${t.bins} by zone` : `This ${t.location} has no ${t.areas} yet`}
              >
                {isAdmin && (
                  <Button onClick={() => setCreateAreaOpen(true)} variant="outline" size="sm" className="rounded-[var(--radius-full)]">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    {`Create ${t.Area}`}
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                <h2 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{t.Areas}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {areas.map((area, index) => (
                  <AreaCard
                    key={area.id}
                    id={area.id}
                    name={area.name}
                    binCount={area.bin_count}
                    isAdmin={isAdmin}
                    index={index}
                    onNavigate={handleAreaClick}
                    onRename={handleRenameArea}
                    onDelete={handleDeleteAreaRequest}
                  />
                ))}
                {unassignedCount > 0 && (
                  <UnassignedAreaCard
                    count={unassignedCount}
                    index={areas.length}
                    onNavigate={handleUnassignedClick}
                  />
                )}
                {isAdmin && (
                  <CreateAreaCard onCreate={() => setCreateAreaOpen(true)} />
                )}
                </div>
              </div>
            )}
          </>
        )}
      </Crossfade>

      {/* Create Area Dialog */}
      <Dialog open={createAreaOpen} onOpenChange={setCreateAreaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Create ${t.Area}`}</DialogTitle>
            <DialogDescription>
              {`${t.Areas} help organize ${t.bins} by zone (e.g. Garage, Kitchen, Closet).`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateArea} className="space-y-5">
            <div className="space-y-2">
              <Input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder={`${t.Area} name...`}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateAreaOpen(false)} className="rounded-[var(--radius-full)]">
                Cancel
              </Button>
              <Button type="submit" disabled={!newAreaName.trim() || creatingArea} className="rounded-[var(--radius-full)]">
                {creatingArea ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Area Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Delete ${t.area}?`}</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.binCount > 0
                ? `"${deleteTarget.name}" has ${deleteTarget.binCount} ${deleteTarget.binCount !== 1 ? t.bins : t.bin}. They will become unassigned.`
                : `Delete "${deleteTarget?.name}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button
              onClick={handleDeleteArea}
              disabled={deletingArea}
              className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:bg-[var(--destructive-hover)] text-[var(--text-on-accent)]"
            >
              {deletingArea ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialogs */}
      <LocationCreateDialog open={createLocationOpen} onOpenChange={setCreateLocationOpen} />
      <LocationJoinDialog open={joinLocationOpen} onOpenChange={setJoinLocationOpen} />
      <LocationRenameDialog
        locationId={renameLocationId}
        currentName={locations.find((l) => l.id === renameLocationId)?.name ?? ''}
        open={!!renameLocationId}
        onOpenChange={(open) => !open && setRenameLocationId(null)}
      />
      <LocationDeleteDialog
        locationId={deleteLocationId}
        locationName={locations.find((l) => l.id === deleteLocationId)?.name ?? ''}
        open={!!deleteLocationId}
        onOpenChange={(open) => !open && setDeleteLocationId(null)}
      />
      {membersLocationId && (
        <LocationMembersDialog
          locationId={membersLocationId}
          open={!!membersLocationId}
          onOpenChange={(open) => !open && setMembersLocationId(null)}
        />
      )}
      <LocationRetentionDialog
        location={locations.find((l) => l.id === retentionLocationId)}
        open={!!retentionLocationId}
        onOpenChange={(open) => !open && setRetentionLocationId(null)}
      />
    </div>
  );
}
