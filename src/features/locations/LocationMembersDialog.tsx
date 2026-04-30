import { Check, Copy, EllipsisVertical, KeyRound, LogOut, UserMinus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogPortal,
} from '@/components/ui/dialog';
import { OptionGroup } from '@/components/ui/option-group';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/lib/auth';
import { usePopover } from '@/lib/usePopover';
import { cn, getErrorMessage } from '@/lib/utils';
import type { LocationMember } from '@/types';
import { LocationInviteShare } from './LocationInviteShare';
import { changeMemberRole, leaveLocation, removeMember, resetMemberPassword, useLocationList, useLocationMembers } from './useLocations';

interface LocationMembersDialogProps {
  locationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationMembersDialog({ locationId, open, onOpenChange }: LocationMembersDialogProps) {
  const { user, setActiveLocationId, activeLocationId } = useAuth();
  const { members, isLoading } = useLocationMembers(locationId);
  const { locations } = useLocationList();
  const { showToast } = useToast();
  const [resetToken, setResetToken] = useState<{ token: string; userId: string } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<LocationMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const location = locations.find((h) => h.id === locationId);
  const isAdmin = location?.role === 'admin';

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter((m) =>
      (m.display_name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q),
    );
  }, [members, memberSearch]);

  async function handleRemoveConfirmed() {
    if (!memberToRemove) return;
    setRemoving(true);
    try {
      await removeMember(locationId, memberToRemove.user_id);
      setMemberToRemove(null);
      showToast({ message: 'Member removed', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to remove member'), variant: 'error' });
    } finally {
      setRemoving(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: 'admin' | 'member' | 'viewer') {
    try {
      await changeMemberRole(locationId, userId, newRole);
      showToast({ message: `Role updated to ${newRole}`, variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to change role'), variant: 'error' });
    }
  }

  const [confirmLeave, setConfirmLeave] = useState(false);

  async function handleLeaveConfirmed() {
    if (!user) return;
    setLeaving(true);
    try {
      await leaveLocation(locationId, user.id);
      if (activeLocationId === locationId) {
        const other = locations.find((h) => h.id !== locationId);
        setActiveLocationId(other?.id ?? null);
      }
      setConfirmLeave(false);
      onOpenChange(false);
      showToast({ message: 'Left location', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to leave'), variant: 'error' });
    } finally {
      setLeaving(false);
    }
  }

  async function handleResetPassword(userId: string) {
    try {
      const { token } = await resetMemberPassword(locationId, userId);
      setResetToken({ token, userId });
      showToast({ message: 'Reset link generated', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to generate reset link'), variant: 'error' });
    }
  }

  const resetLink = resetToken ? `${window.location.origin}/reset-password?token=${resetToken.token}` : '';

  async function handleCopyResetLink() {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink);
      setResetCopied(true);
      setTimeout(() => setResetCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy', variant: 'error' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setResetToken(null); setMemberSearch(''); setMemberToRemove(null); setConfirmLeave(false); } onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location?.name ?? 'Location'} Members</DialogTitle>
          <DialogDescription>
            Manage members and share the invite code.
          </DialogDescription>
        </DialogHeader>

        {/* Invite share (admin only — component returns null otherwise) */}
        {location && <LocationInviteShare location={location} variant="compact" />}

        {/* Members list */}
        {isLoading ? (
          <SkeletonList count={2} className="space-y-1 py-2">
            {() => (
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            )}
          </SkeletonList>
        ) : (
          <div className="space-y-1 py-2">
            {members.length > 5 && (
              <SearchInput
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                onClear={memberSearch ? () => setMemberSearch('') : undefined}
                placeholder="Search members..."
                containerClassName="mb-2"
              />
            )}
            {filteredMembers.map((member) => {
              const isSelf = member.user_id === user?.id;
              const displayName = member.display_name || member.user_id.slice(0, 8);
              const showEmail = member.email && member.email !== member.display_name;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-sm)]"
                >
                  <UserAvatar
                    displayName={member.display_name || member.user_id}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[14px] text-[var(--text-primary)] truncate block">
                      {isSelf ? 'You' : displayName}
                    </span>
                    {showEmail && (
                      <span className="text-[12px] text-[var(--text-tertiary)] truncate block">
                        {member.email}
                      </span>
                    )}
                  </div>
                  {isAdmin && !isSelf && (
                    <RoleSelector
                      currentRole={member.role}
                      onChangeRole={(role) => handleRoleChange(member.user_id, role)}
                    />
                  )}
                  {isAdmin && !isSelf && (
                    <MemberActionMenu
                      onResetPassword={() => handleResetPassword(member.user_id)}
                      onRemove={() => setMemberToRemove(member)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {resetToken && (
          <div className="space-y-2 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
            <p className="text-[13px] text-[var(--text-secondary)]">
              Share this link with the member to reset their password:
            </p>
            <div className="row gap-2">
              <code className="flex-1 min-w-0 text-[12px] text-[var(--text-primary)] break-all">
                {resetLink}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyResetLink}
                className="shrink-0"
                aria-label="Copy reset link"
              >
                {resetCopied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Leave button for non-admins */}
        {!isAdmin && !confirmLeave && (
          <Button
            variant="destructive-outline"
            onClick={() => setConfirmLeave(true)}
            className="w-full rounded-[var(--radius-sm)]"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Leave Location
          </Button>
        )}
        {!isAdmin && confirmLeave && (
          <div className="space-y-2 p-3 rounded-[var(--radius-sm)] bg-[var(--destructive-soft)]">
            <p className="text-[13px] text-[var(--text-secondary)]">
              You&apos;ll lose access to all content in this location. Continue?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(false)} disabled={leaving}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLeaveConfirmed} disabled={leaving}>
                {leaving ? 'Leaving...' : 'Leave'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Remove member confirmation dialog */}
      <Dialog open={memberToRemove !== null} onOpenChange={(v) => { if (!v) setMemberToRemove(null); }}>
        <DialogContent className="flat-popover">
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Remove {memberToRemove?.display_name || memberToRemove?.email || 'this member'} from {location?.name ?? 'this location'}? They will lose access to all bins in this location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMemberToRemove(null)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveConfirmed} disabled={removing}>
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function MemberActionMenu({ onResetPassword, onRemove }: { onResetPassword: () => void; onRemove: () => void }) {
  const dialogPortal = useDialogPortal();
  const { visible, animating, isOpen, toggle, close } = usePopover();
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    reposition();
    function handleClick(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) close();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, close, reposition]);

  const menu = visible && pos && (
    <div
      ref={menuRef}
      className={cn(
        animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
        'fixed z-[100] min-w-[170px] rounded-[var(--radius-lg)] flat-popover overflow-hidden',
      )}
      style={{ top: pos.top, right: pos.right }}
    >
      <button
        type="button"
        onClick={() => { close(); onResetPassword(); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <KeyRound className="h-4 w-4" />
        Reset password
      </button>
      <div className="my-1 border-t border-[var(--border-flat)]" />
      <button
        type="button"
        onClick={() => { close(); onRemove(); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <UserMinus className="h-4 w-4" />
        Remove member
      </button>
    </div>
  );

  return (
    <div ref={triggerRef} className="shrink-0">
      <Tooltip content="More actions" side="bottom">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label="More actions"
        >
          <EllipsisVertical className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      {dialogPortal ? createPortal(menu, dialogPortal) : menu}
    </div>
  );
}

const roleOptions = [
  { key: 'viewer' as const, label: 'Viewer' },
  { key: 'member' as const, label: 'Member' },
  { key: 'admin' as const, label: 'Admin' },
];

function RoleSelector({ currentRole, onChangeRole }: { currentRole: LocationMember['role']; onChangeRole: (role: LocationMember['role']) => void }) {
  return (
    <OptionGroup
      options={roleOptions}
      value={currentRole}
      onChange={onChangeRole}
      size="sm"
    />
  );
}
