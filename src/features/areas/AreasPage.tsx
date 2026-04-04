import { Box, Check, Copy, Download, Eye, FolderOpen, LogIn, MapPin, MapPinned, Plus, QrCode, Share2, Shield, User, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useAuth } from '@/lib/auth';
import { generateQRDataURL } from '@/lib/qr';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import { usePlan } from '@/lib/usePlan';
import { cn, getErrorMessage } from '@/lib/utils';
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

  // Leave confirmation state
  const [leaveLocationId, setLeaveLocationId] = useState<string | null>(null);

  const activeLocation = locations.find((l) => l.id === activeLocationId);

  const inviteLink = useMemo(() => {
    if (!activeLocation?.invite_code) return '';
    return `${window.location.origin}/register?invite=${encodeURIComponent(activeLocation.invite_code)}`;
  }, [activeLocation?.invite_code]);

  // Generate invite QR code data URL when toggled open (memoized by invite code)
  useEffect(() => {
    if (!inviteQrOpen || !inviteLink) {
      setInviteQrUrl(null);
      return;
    }
    let cancelled = false;
    generateQRDataURL(inviteLink, 256).then((url) => {
      if (!cancelled) setInviteQrUrl(url);
    });
    return () => { cancelled = true; };
  }, [inviteQrOpen, inviteLink]);
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

  async function handleLeaveConfirmed() {
    if (!user || !leaveLocationId) return;
    try {
      await leaveLocation(leaveLocationId, user.id);
      if (activeLocationId === leaveLocationId) {
        const other = locations.find((l) => l.id !== leaveLocationId);
        setActiveLocationId(other?.id ?? null);
      }
      setLeaveLocationId(null);
      showToast({ message: 'Left location', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to leave'), variant: 'error' });
    }
  }

  const handleDownloadQr = useCallback(() => {
    if (!inviteQrUrl) return;
    const a = document.createElement('a');
    a.href = inviteQrUrl;
    a.download = `invite-qr-${activeLocation?.name ?? 'code'}.png`;
    a.click();
  }, [inviteQrUrl, activeLocation?.name]);

  const handleShareInvite = useCallback(async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${activeLocation?.name ?? 'location'}`, url: inviteLink });
      } catch { /* cancelled by user */ }
    } else {
      try {
        await navigator.clipboard.writeText(inviteLink);
        showToast({ message: 'Invite link copied', variant: 'success' });
      } catch {
        showToast({ message: 'Failed to copy', variant: 'error' });
      }
    }
  }, [inviteLink, activeLocation?.name, showToast]);

  const memberCount = activeLocation?.member_count ?? 0;
  const deleteTargetLocation = locations.find((l) => l.id === deleteLocationId);
  const leaveTargetLocation = locations.find((l) => l.id === leaveLocationId);

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
            {/* Info card skeleton */}
            <div className="flat-card rounded-[var(--radius-lg)] p-4">
              <div className="row-spread">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-16 rounded-[var(--radius-full)]" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-7 w-7 rounded-[var(--radius-xs)]" />
              </div>
            </div>
            {/* Area list skeleton */}
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3.5 w-12" />
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flat-card rounded-[var(--radius-lg)] p-4 flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-[var(--radius-sm)]" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
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
            <div className="flat-card rounded-[var(--radius-lg)] p-4 space-y-3">
              {/* Top row: role + stats + settings */}
              <div className="row-spread gap-3">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <span
                    role="img"
                    aria-label={`Your role: ${isAdmin ? 'Admin' : isViewer ? 'Viewer' : 'Member'}`}
                    className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-1 rounded-[var(--radius-full)] shrink-0', isAdmin ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]')}
                  >
                    {isAdmin ? <Shield className="h-3 w-3" /> : isViewer ? <Eye className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {isAdmin ? 'Admin' : isViewer ? 'Viewer' : 'Member'}
                  </span>
                  <span className="text-[var(--text-tertiary)] opacity-30 shrink-0">&middot;</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                    onClick={() => setMembersLocationId(activeLocation.id)}
                    aria-label={`View ${memberCount} ${memberCount !== 1 ? 'members' : 'member'}`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{memberCount} {memberCount !== 1 ? 'members' : 'member'}</span>
                    <span className="sm:hidden">{memberCount}</span>
                  </button>
                  {(activeLocation.bin_count != null || activeLocation.area_count != null) && (
                    <>
                      <span className="text-[var(--text-tertiary)] opacity-30 shrink-0">&middot;</span>
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] shrink-0">
                        <Box className="h-3.5 w-3.5" />
                        <span>{activeLocation.bin_count ?? 0} {(activeLocation.bin_count ?? 0) !== 1 ? t.bins : t.bin}</span>
                      </span>
                      <span className="text-[var(--text-tertiary)] opacity-30 shrink-0 hidden sm:inline">&middot;</span>
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] shrink-0">
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>{activeLocation.area_count ?? 0} {(activeLocation.area_count ?? 0) !== 1 ? t.areas : t.area}</span>
                      </span>
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
                  onLeave={() => setLeaveLocationId(activeLocation.id)}
                />
              </div>
              {/* Bottom row: invite code (admin only) */}
              {activeLocation.invite_code && isAdmin && (
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-flat)]">
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer min-w-0"
                    aria-label="Copy invite code"
                  >
                    {copied
                      ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-success)]" />
                      : <Copy className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{activeLocation.invite_code}</span>
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setInviteQrOpen((o) => !o)}
                    className="inline-flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                    aria-label={inviteQrOpen ? 'Hide invite QR code' : 'Show invite QR code'}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareInvite}
                    className="inline-flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                    aria-label="Share invite link"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                </div>
              )}
            </div>

            {/* Invite QR code */}
            {inviteQrOpen && activeLocation.invite_code && isAdmin && (
              <div className="flat-card rounded-[var(--radius-lg)] p-4 flex flex-col items-center gap-3 animate-card-stagger">
                <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                  Scan to join <span className="font-semibold">{activeLocation.name}</span>
                </p>
                {inviteQrUrl ? (
                  <img src={inviteQrUrl} alt="Invite QR code" className="w-48 h-48 rounded-[var(--radius-md)]" />
                ) : (
                  <Skeleton className="w-48 h-48" />
                )}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadQr}
                    disabled={!inviteQrUrl}
                    className="text-[12px]"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShareInvite}
                    className="text-[12px]"
                  >
                    <Share2 className="h-3.5 w-3.5 mr-1" />
                    Share Link
                  </Button>
                </div>
              </div>
            )}

            {/* Area grid */}
            {areas.length === 0 && unassignedCount === 0 ? (
              <EmptyState
                icon={MapPinned}
                title={`No ${t.areas} yet`}
                subtitle={isAdmin ? `Create ${t.areas} to organize your ${t.bins} by zone` : `This ${t.location} has no ${t.areas} yet`}
              >
                {isAdmin ? (
                  <Button onClick={() => setCreateAreaOpen(true)} variant="outline" size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    {`Create ${t.Area}`}
                  </Button>
                ) : (
                  <Button onClick={() => navigate('/bins')} variant="outline" size="sm">
                    <Box className="h-3.5 w-3.5 mr-1.5" />
                    {`Browse ${t.Bins}`}
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                <h2 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{t.Areas}</h2>
                <div className="flex flex-col gap-2">
                {flattenAreaTree(areaTree).map((node: AreaTreeNode, index: number) => (
                  <div key={node.id} className="animate-card-stagger" style={{ '--stagger-index': index } as React.CSSProperties}>
                    <AreaCard
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
                  </div>
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
        locationName={deleteTargetLocation?.name ?? ''}
        binCount={deleteTargetLocation?.bin_count}
        areaCount={deleteTargetLocation?.area_count}
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

      {/* Leave confirmation dialog */}
      <Dialog open={!!leaveLocationId} onOpenChange={(open) => !open && setLeaveLocationId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave {t.Location}?</DialogTitle>
            <DialogDescription>
              You&apos;ll lose access to all {t.bins} and {t.areas} in &quot;{leaveTargetLocation?.name ?? ''}&quot;. You can rejoin later with an invite code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeaveLocationId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeaveConfirmed}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
