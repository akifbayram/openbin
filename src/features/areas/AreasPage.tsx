import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPinned, Plus, Pencil, Trash2, X, Check, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useBinList } from '@/features/bins/useBins';
import { useLocationList } from '@/features/locations/useLocations';
import { LocationCreateDialog, LocationJoinDialog, LocationRenameDialog, LocationDeleteDialog } from '@/features/locations/LocationDialogs';
import { LocationMembersDialog } from '@/features/locations/LocationMembersDialog';
import { LocationRetentionDialog } from '@/features/locations/LocationRetentionDialog';
import { LocationSwitcher } from './LocationSwitcher';
import { LocationToolbar } from './LocationToolbar';
import { useAreaList, createArea, updateArea, deleteArea } from './useAreas';
import { useTerminology } from '@/lib/terminology';

interface AreaInfo {
  id: string;
  name: string;
  binCount: number;
}

export function AreasPage() {
  const t = useTerminology();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user, activeLocationId, setActiveLocationId } = useAuth();
  const { locations, isLoading: locationsLoading } = useLocationList();
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

  // Rename area state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete area state
  const [deleteTarget, setDeleteTarget] = useState<AreaInfo | null>(null);
  const [deletingArea, setDeletingArea] = useState(false);

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const isOwner = activeLocation?.created_by === user?.id;

  const areaInfos = useMemo(() => {
    const countMap = new Map<string | null, number>();
    for (const bin of bins) {
      const key = bin.area_id;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    const result: AreaInfo[] = areas.map((a) => ({
      id: a.id,
      name: a.name,
      binCount: countMap.get(a.id) || 0,
    }));
    result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  }, [areas, bins]);

  const unassignedCount = useMemo(() => {
    return bins.filter((b) => !b.area_id).length;
  }, [bins]);

  const filteredAreas = useMemo(() => {
    if (!search.trim()) return areaInfos;
    const q = search.toLowerCase().trim();
    return areaInfos.filter((a) => a.name.toLowerCase().includes(q));
  }, [areaInfos, search]);

  function handleAreaClick(areaId: string) {
    navigate('/bins', { state: { areaFilter: areaId } });
  }

  function handleUnassignedClick() {
    navigate('/bins', { state: { areaFilter: '__unassigned__' } });
  }

  async function handleCreateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!newAreaName.trim() || !activeLocationId) return;
    setCreatingArea(true);
    try {
      await createArea(activeLocationId, newAreaName.trim());
      setNewAreaName('');
      setCreateAreaOpen(false);
    } catch {
      // Duplicate name — silently fail
    } finally {
      setCreatingArea(false);
    }
  }

  function startRename(area: AreaInfo) {
    setRenamingId(area.id);
    setRenameValue(area.name);
  }

  async function handleRename() {
    if (!renamingId || !renameValue.trim() || !activeLocationId) return;
    setRenaming(true);
    try {
      await updateArea(activeLocationId, renamingId, renameValue.trim());
      setRenamingId(null);
      setRenameValue('');
    } catch {
      // Duplicate name — silently fail
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteArea() {
    if (!deleteTarget || !activeLocationId) return;
    setDeletingArea(true);
    try {
      await deleteArea(activeLocationId, deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeletingArea(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2">
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

      {/* Location Switcher */}
      <LocationSwitcher
        locations={locations}
        activeLocationId={activeLocationId}
        onSelect={setActiveLocationId}
        onCreateClick={() => setCreateLocationOpen(true)}
        onJoinClick={() => setJoinLocationOpen(true)}
        isLoading={locationsLoading}
      />

      {/* Location Toolbar + Areas (only when a location is selected) */}
      {activeLocation && (
        <>
          <LocationToolbar
            location={activeLocation}
            isOwner={isOwner}
            onMembers={() => setMembersLocationId(activeLocation.id)}
            onRetention={() => setRetentionLocationId(activeLocation.id)}
            onRename={() => setRenameLocationId(activeLocation.id)}
            onDelete={() => setDeleteLocationId(activeLocation.id)}
          />

          {/* Areas Section */}
          <div className="flex items-center justify-between mt-2">
            <Label className="text-[13px] uppercase tracking-wider">{t.Areas}</Label>
            <Button
              onClick={() => setCreateAreaOpen(true)}
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label={`Create ${t.area}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {areaInfos.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${t.areas}...`}
                className="pl-10 rounded-[var(--radius-full)] h-10 text-[15px]"
              />
            </div>
          )}

          {filteredAreas.length === 0 && !unassignedCount ? (
            <div className="flex flex-col items-center justify-center gap-5 py-16 text-[var(--text-tertiary)]">
              <MapPinned className="h-16 w-16 opacity-40" />
              <div className="text-center space-y-1.5">
                <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
                  {search ? `No ${t.areas} match your search` : `No ${t.areas} yet`}
                </p>
                {!search && (
                  <p className="text-[13px]">{`Create ${t.areas} to organize ${t.bins} by zone (e.g. Garage, Kitchen)`}</p>
                )}
              </div>
              {!search && (
                <Button onClick={() => setCreateAreaOpen(true)} variant="outline" className="rounded-[var(--radius-full)] mt-1">
                  <Plus className="h-4 w-4 mr-2" />
                  {`Create ${t.Area}`}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredAreas.map((area) => (
                <div
                  key={area.id}
                  className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 transition-all duration-200"
                >
                  {renamingId === area.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleRename(); }
                          if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                        }}
                        disabled={renaming}
                        autoFocus
                        className="h-8 text-[14px] flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRename}
                        disabled={!renameValue.trim() || renaming}
                        className="h-8 w-8 rounded-full shrink-0"
                        aria-label="Save"
                      >
                        <Check className="h-4 w-4 text-[var(--accent)]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setRenamingId(null); setRenameValue(''); }}
                        className="h-8 w-8 rounded-full shrink-0"
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="flex-1 min-w-0 text-left cursor-pointer"
                        onClick={() => handleAreaClick(area.id)}
                      >
                        <span className="text-[15px] font-medium text-[var(--text-primary)] truncate block">
                          {area.name}
                        </span>
                      </button>
                      <span className="text-[13px] text-[var(--text-tertiary)] shrink-0">
                        {area.binCount} {area.binCount !== 1 ? t.bins : t.bin}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); startRename(area); }}
                        className="h-8 w-8 rounded-full shrink-0"
                        aria-label={`Rename ${area.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(area); }}
                        className="h-8 w-8 rounded-full shrink-0 text-[var(--destructive)]"
                        aria-label={`Delete ${area.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}

              {/* Unassigned bins row */}
              {unassignedCount > 0 && !search && (
                <button
                  onClick={handleUnassignedClick}
                  className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 cursor-pointer transition-all duration-200 active:scale-[0.98] hover:bg-[var(--bg-hover)] mt-2"
                >
                  <span className="flex-1 text-[15px] text-[var(--text-tertiary)] italic">
                    Unassigned
                  </span>
                  <span className="text-[13px] text-[var(--text-tertiary)]">
                    {unassignedCount} {unassignedCount !== 1 ? t.bins : t.bin}
                  </span>
                </button>
              )}
            </div>
          )}
        </>
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
