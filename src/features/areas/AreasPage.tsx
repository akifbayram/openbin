import { Check, Copy, Eye, LogIn, MapPin, MapPinned, Plus, QrCode, Shield, User, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { UpgradePrompt } from '@/components/ui/upgrade-prompt';
import { CustomFieldsDialog } from '@/features/bins/CustomFieldsDialog';
import { LocationCreateDialog, LocationDeleteDialog, LocationJoinDialog, LocationRenameDialog } from '@/features/locations/LocationDialogs';
import { LocationMembersDialog } from '@/features/locations/LocationMembersDialog';
import { LocationRetentionDialog } from '@/features/locations/LocationRetentionDialog';
import { leaveLocation, useLocationList } from '@/features/locations/useLocations';
import { ApiError } from '@/lib/api';
import { generateQRDataURL } from '@/lib/qr';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import { usePlan } from '@/lib/usePlan';
import { cn } from '@/lib/utils';
import { AreaCard, CreateAreaCard, UnassignedAreaCard } from './AreaCard';
import { CreateAreaDialog, DeleteAreaDialog } from './AreaDialogs';
import { LocationSettingsMenu } from './LocationSettingsMenu';
import { LocationTabs } from './LocationTabs';
import { type AreaTreeNode, flattenAreaTree, updateArea, useAreaList } from './useAreas';

export function AreasPage() {
  const t = useTerminology();
  const navigate = useNavigate();
  const { user, activeLocationId, setActiveLocationId } = useAuth();
  const { locations, isLoading: locationsLoading } = useLocationList();
  const { showToast } = useToast();
  const { areas, areaTree, unassignedCount } = useAreaList(activeLocationId);
  const { isGated, isSelfHosted, planInfo } = usePlan();
  const customFieldsGated = !isSelfHosted && isGated('customFields');

  // Location dialog state
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [joinLocationOpen, setJoinLocationOpen] = useState(false);
  const [membersLocationId, setMembersLocationId] = useState<string | null>(null);
  const lastMembersLocationId = useRef(membersLocationId);
  if (membersLocationId) lastMembersLocationId.current = membersLocationId;
  const [renameLocationId, setRenameLocationId] = useState<string | null>(null);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [retentionLocationId, setRetentionLocationId] = useState<string | null>(null);
  const [customFieldsLocationId, setCustomFieldsLocationId] = useState<string | null>(null);

  // Create area state
  const [createAreaOpen, setCreateAreaOpen] = useState(false);

  // Delete area state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; binCount: number; descendantAreaCount?: number; descendantBinCount?: number } | null>(null);

  // Invite code copy state
  const [copied, setCopied] = useState(false);
  const [inviteQrOpen, setInviteQrOpen] = useState(false);
  const [inviteQrUrl, setInviteQrUrl] = useState<string | null>(null);

  const activeLocation = locations.find((l) => l.id === activeLocationId);

  // Generate invite QR code data URL when toggled open
  useEffect(() => {
    if (!inviteQrOpen || !activeLocation?.invite_code) {
      setInviteQrUrl(null);
      return;
    }
    let cancelled = false;
    const inviteLink = `${window.location.origin}/register?invite=${encodeURIComponent(activeLocation.invite_code)}`;
    generateQRDataURL(inviteLink, 256).then((url) => {
      if (!cancelled) setInviteQrUrl(url);
    });
    return () => { cancelled = true; };
  }, [inviteQrOpen, activeLocation?.invite_code]);
  const { isAdmin, isViewer } = usePermissions();

  async function handleCopyInvite() {
    if (!activeLocation?.invite_code) return;
    try {
      await navigator.clipboard.writeText(activeLocation.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy', variant: 'error' });
    }
  }

  function handleAreaClick(areaId: string) {
    navigate(`/bins?areas=${encodeURIComponent(areaId)}`);
  }

  function handleUnassignedClick() {
    navigate('/bins?areas=__unassigned__');
  }

  async function handleRenameArea(areaId: string, newName: string) {
    if (!activeLocationId) return;
    try {
      await updateArea(activeLocationId, areaId, newName);
    } catch (err) {
      showToast({ message: err instanceof ApiError && err.status === 409 ? `${t.Area} name already exists` : 'Something went wrong', variant: 'error' });
      throw err;
    }
  }

  function handleDeleteAreaRequest(areaId: string, name: string, binCount: number, descendantAreaCount?: number, descendantBinCount?: number) {
    setDeleteTarget({ id: areaId, name, binCount, descendantAreaCount, descendantBinCount });
  }

  async function handleLeave(locationId: string) {
    if (!user) return;
    try {
      await leaveLocation(locationId, user.id);
      if (activeLocationId === locationId) {
        const other = locations.find((l) => l.id !== locationId);
        setActiveLocationId(other?.id ?? null);
      }
      showToast({ message: 'Left location', variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to leave', variant: 'error' });
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
              className="h-10 px-3.5"
            >
              <LogIn className="h-4 w-4 mr-1.5" />
              Join
            </Button>
            <Button
              onClick={() => setCreateLocationOpen(true)}
              size="icon"
              className="h-10 w-10 rounded-[var(--radius-sm)]"
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
            <div className="row">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-1" />
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Area grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flat-card rounded-[var(--radius-lg)] p-4 space-y-2">
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
            variant="onboard"
          >
            <div className="flex gap-2.5">
              <Button onClick={() => setJoinLocationOpen(true)} variant="outline">
                <LogIn className="h-4 w-4 mr-2" />
                Join Location
              </Button>
              <Button onClick={() => setCreateLocationOpen(true)}>
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
            <div className="flat-card rounded-[var(--radius-lg)] p-4">
              <div className="row-spread gap-3">
                <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                  <div className="row shrink-0">
                    <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-1 rounded-[var(--radius-full)]', isAdmin ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]')}>
                      {isAdmin ? <Shield className="h-3 w-3" /> : isViewer ? <Eye className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {isAdmin ? 'Admin' : isViewer ? 'Viewer' : 'Member'}
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
                          ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-success)]" />
                          : <Copy className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{activeLocation.invite_code}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteQrOpen((o) => !o)}
                        className="inline-flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                        title="Show invite QR code"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <LocationSettingsMenu
                  compact
                  isAdmin={isAdmin}
                  onRename={() => setRenameLocationId(activeLocation.id)}
                  onRetention={() => setRetentionLocationId(activeLocation.id)}
                  onCustomFields={() => setCustomFieldsLocationId(activeLocation.id)}
                  onDelete={() => setDeleteLocationId(activeLocation.id)}
                  onLeave={() => handleLeave(activeLocation.id)}
                />
              </div>
            </div>

            {/* Invite QR code */}
            {inviteQrOpen && activeLocation.invite_code && isAdmin && (
              <div className="flat-card rounded-[var(--radius-lg)] p-4 flex flex-col items-center gap-3">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                  Scan to register and join this {t.location}
                </p>
                {inviteQrUrl ? (
                  <img src={inviteQrUrl} alt="Invite QR code" className="w-48 h-48 rounded-[var(--radius-md)]" />
                ) : (
                  <Skeleton className="w-48 h-48" />
                )}
                <p className="text-[11px] text-[var(--text-tertiary)] font-mono break-all text-center max-w-xs">
                  {`${window.location.origin}/register?invite=${activeLocation.invite_code}`}
                </p>
              </div>
            )}

            {/* Area grid */}
            {areas.length === 0 && unassignedCount === 0 ? (
              <EmptyState
                icon={MapPinned}
                title={`No ${t.areas} yet`}
                subtitle={isAdmin ? `Create ${t.areas} to organize your ${t.bins} by zone` : `This ${t.location} has no ${t.areas} yet`}
              >
                {isAdmin && (
                  <Button onClick={() => setCreateAreaOpen(true)} variant="outline" size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    {`Create ${t.Area}`}
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                <h2 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{t.Areas}</h2>
                <div className="flex flex-col gap-2">
                {flattenAreaTree(areaTree).map((node: AreaTreeNode) => (
                  <AreaCard
                    key={node.id}
                    id={node.id}
                    name={node.name}
                    binCount={node.bin_count}
                    descendantBinCount={node.descendant_bin_count}
                    depth={node.depth}
                    hasChildren={node.children.length > 0}
                    isAdmin={isAdmin}
                    onNavigate={handleAreaClick}
                    onRename={handleRenameArea}
                    onDelete={handleDeleteAreaRequest}
                  />
                ))}
                {unassignedCount > 0 && (
                  <UnassignedAreaCard
                    count={unassignedCount}
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

      {/* Area Dialogs */}
      <CreateAreaDialog open={createAreaOpen} onOpenChange={setCreateAreaOpen} locationId={activeLocationId} areas={areas} />
      <DeleteAreaDialog target={deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} locationId={activeLocationId} />

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
      <LocationMembersDialog
        locationId={membersLocationId ?? lastMembersLocationId.current ?? ''}
        open={!!membersLocationId}
        onOpenChange={(open) => !open && setMembersLocationId(null)}
      />
      <LocationRetentionDialog
        location={locations.find((l) => l.id === retentionLocationId)}
        open={!!retentionLocationId}
        onOpenChange={(open) => !open && setRetentionLocationId(null)}
      />
      {customFieldsGated ? (
        <Dialog open={!!customFieldsLocationId} onOpenChange={(open) => !open && setCustomFieldsLocationId(null)}>
          <DialogContent>
            <UpgradePrompt feature="Custom Fields" description="Define custom fields for your bins." upgradeUrl={planInfo.upgradeUrl} />
          </DialogContent>
        </Dialog>
      ) : (
        <CustomFieldsDialog
          locationId={customFieldsLocationId}
          open={!!customFieldsLocationId}
          onOpenChange={(open) => !open && setCustomFieldsLocationId(null)}
        />
      )}
    </div>
  );
}
