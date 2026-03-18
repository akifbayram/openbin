import { Check, Copy, EllipsisVertical, KeyRound, LogOut, RefreshCw, UserMinus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useDialogPortal,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/lib/auth';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import { changeMemberRole, leaveLocation, regenerateInvite, removeMember, resetMemberPassword, useLocationList, useLocationMembers } from './useLocations';

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
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [resetToken, setResetToken] = useState<{ token: string; userId: string } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  const location = locations.find((h) => h.id === locationId);
  const isAdmin = location?.role === 'admin';

  async function handleCopyInvite() {
    if (!location?.invite_code) return;
    try {
      await navigator.clipboard.writeText(location.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy', variant: 'error' });
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateInvite(locationId);
      showToast({ message: 'Invite code regenerated', variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to regenerate', variant: 'error' });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeMember(locationId, userId);
      showToast({ message: 'Member removed', variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to remove member', variant: 'error' });
    }
  }

  async function handleRoleChange(userId: string, newRole: 'admin' | 'member' | 'viewer') {
    try {
      await changeMemberRole(locationId, userId, newRole);
      showToast({ message: `Role updated to ${newRole}`, variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to change role', variant: 'error' });
    }
  }

  async function handleLeave() {
    if (!user) return;
    try {
      await leaveLocation(locationId, user.id);
      if (activeLocationId === locationId) {
        const other = locations.find((h) => h.id !== locationId);
        setActiveLocationId(other?.id ?? null);
      }
      onOpenChange(false);
      showToast({ message: 'Left location', variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to leave', variant: 'error' });
    }
  }

  async function handleResetPassword(userId: string) {
    try {
      const { token } = await resetMemberPassword(locationId, userId);
      setResetToken({ token, userId });
      showToast({ message: 'Reset link generated', variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to generate reset link', variant: 'error' });
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) setResetToken(null); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location?.name ?? 'Location'} Members</DialogTitle>
          <DialogDescription>
            Manage members and share the invite code.
          </DialogDescription>
        </DialogHeader>

        {/* Invite Code */}
        {location?.invite_code && (
          <div className="row p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
            <span className="flex-1 min-w-0 text-[14px] font-mono text-[var(--text-primary)] tracking-wider truncate">
              {location.invite_code}
            </span>
            <Tooltip content="Copy invite code" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyInvite}
                className="shrink-0"
                aria-label="Copy invite code"
              >
                {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </Tooltip>
            {isAdmin && (
              <Tooltip content="Regenerate invite code" side="bottom">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="shrink-0"
                  aria-label="Regenerate invite code"
                >
                  <RefreshCw className={cn('h-4 w-4', regenerating && 'animate-spin')} />
                </Button>
              </Tooltip>
            )}
          </div>
        )}

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
            {members.map((member) => {
              const isSelf = member.user_id === user?.id;
              const displayName = member.display_name || member.user_id.slice(0, 8);
              const showUsername = member.username && member.username !== member.display_name;
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
                    {showUsername && (
                      <span className="text-[12px] text-[var(--text-tertiary)] truncate block">
                        @{member.username}
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
                      onRemove={() => handleRemoveMember(member.user_id)}
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
        {!isAdmin && (
          <Button
            variant="destructive-outline"
            onClick={handleLeave}
            className="w-full rounded-[var(--radius-sm)]"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Leave Location
          </Button>
        )}
      </DialogContent>
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

function RoleSelector({ currentRole, onChangeRole }: { currentRole: string; onChangeRole: (role: 'admin' | 'member' | 'viewer') => void }) {
  const roles = ['viewer', 'member', 'admin'] as const;
  return (
    <div className="flex gap-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-input)] p-0.5">
      {roles.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChangeRole(r)}
          className={cn(
            'px-2 py-1 text-[12px] font-medium rounded-[var(--radius-xs)] capitalize transition-colors',
            currentRole === r
              ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-flat)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
