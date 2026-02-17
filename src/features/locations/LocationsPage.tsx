import { useState } from 'react';
import { MapPin, Plus, LogIn, Users, Crown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { useLocationList } from './useLocations';
import { LocationMembersDialog } from './LocationMembersDialog';
import { LocationCreateDialog, LocationJoinDialog, LocationRenameDialog, LocationDeleteDialog } from './LocationDialogs';

export function LocationsPage() {
  const { user, setActiveLocationId, activeLocationId } = useAuth();
  const { locations, isLoading } = useLocationList();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [membersLocationId, setMembersLocationId] = useState<string | null>(null);
  const [renameLocationId, setRenameLocationId] = useState<string | null>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-3xl mx-auto">
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
            const isOwner = loc.created_by === user?.id || (loc as unknown as Record<string, unknown>).role === 'owner';
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
                              onClick={() => setRenameLocationId(loc.id)}
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

      <LocationCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <LocationJoinDialog open={joinOpen} onOpenChange={setJoinOpen} />
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
