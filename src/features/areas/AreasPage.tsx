import { useState } from 'react';
import { MapPin, Plus, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { useBinList } from '@/features/bins/useBins';
import { useLocationList, leaveLocation } from '@/features/locations/useLocations';
import { LocationCreateDialog, LocationJoinDialog, LocationRenameDialog, LocationDeleteDialog } from '@/features/locations/LocationDialogs';
import { LocationMembersDialog } from '@/features/locations/LocationMembersDialog';
import { LocationRetentionDialog } from '@/features/locations/LocationRetentionDialog';
import { useAreaList, createArea, updateArea, deleteArea } from './useAreas';
import { useTerminology } from '@/lib/terminology';
import { LocationCard } from './LocationCard';

interface DeleteAreaTarget {
  id: string;
  name: string;
  binCount: number;
}

export function AreasPage() {
  const t = useTerminology();
  const { user, activeLocationId, setActiveLocationId } = useAuth();
  const { locations, isLoading: locationsLoading } = useLocationList();
  const { showToast } = useToast();
  const { areas } = useAreaList(activeLocationId);
  const { bins } = useBinList();

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

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const inactiveLocations = locations.filter((l) => l.id !== activeLocationId);

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

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          {t.Locations}
        </h1>
        {locations.length > 0 && (
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
        )}
      </div>

      {/* Loading state */}
      {locationsLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-20 rounded-[var(--radius-lg)]" />
        </div>
      )}

      {/* Empty state */}
      {!locationsLoading && locations.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <MapPin className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">No locations yet</p>
            <p className="text-[13px]">Create a location or join one with an invite code</p>
          </div>
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
        </div>
      )}

      {/* Active location card */}
      {!locationsLoading && activeLocation && (
        <LocationCard
          location={activeLocation}
          isActive
          areas={areas}
          bins={bins}
          onSetActive={setActiveLocationId}
          onMembers={setMembersLocationId}
          onRename={setRenameLocationId}
          onRetention={setRetentionLocationId}
          onDelete={setDeleteLocationId}
          onLeave={handleLeave}
          onCreateArea={() => setCreateAreaOpen(true)}
          onRenameArea={handleRenameArea}
          onDeleteArea={handleDeleteAreaRequest}
        />
      )}

      {/* Inactive location cards */}
      {!locationsLoading && inactiveLocations.length > 0 && (
        <div className="flex flex-col gap-2">
          {inactiveLocations.length > 0 && locations.length > 1 && (
            <span className="text-[13px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">
              Other {t.Locations}
            </span>
          )}
          {inactiveLocations.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              isActive={false}
              areas={[]}
              bins={[]}
              onSetActive={setActiveLocationId}
              onMembers={setMembersLocationId}
              onRename={setRenameLocationId}
              onRetention={setRetentionLocationId}
              onDelete={setDeleteLocationId}
              onLeave={handleLeave}
              onCreateArea={() => {}}
              onRenameArea={async () => {}}
              onDeleteArea={() => {}}
            />
          ))}
        </div>
      )}

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
