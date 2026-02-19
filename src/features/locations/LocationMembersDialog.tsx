import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, UserMinus, Shield, RefreshCw, LogOut, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { useLocationMembers, useLocationList, removeMember, leaveLocation, regenerateInvite, changeMemberRole } from './useLocations';

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

  const location = locations.find((h) => h.id === locationId);
  const isAdmin = location?.role === 'admin';

  async function handleCopyInvite() {
    if (!location?.invite_code) return;
    try {
      await navigator.clipboard.writeText(location.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy' });
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateInvite(locationId);
      showToast({ message: 'Invite code regenerated' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to regenerate' });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeMember(locationId, userId);
      showToast({ message: 'Member removed' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to remove member' });
    }
  }

  async function handleRoleChange(userId: string, newRole: 'admin' | 'member') {
    try {
      await changeMemberRole(locationId, userId, newRole);
      showToast({ message: `Role updated to ${newRole}` });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to change role' });
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
      showToast({ message: 'Left location' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to leave' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location?.name ?? 'Location'} Members</DialogTitle>
          <DialogDescription>
            Manage members and share the invite code.
          </DialogDescription>
        </DialogHeader>

        {/* Invite Code */}
        {location?.invite_code && (
          <div className="flex items-center gap-2 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
            <span className="flex-1 min-w-0 text-[14px] font-mono text-[var(--text-primary)] tracking-wider truncate">
              {location.invite_code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyInvite}
              className="h-8 w-8 rounded-full shrink-0"
              aria-label="Copy invite code"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="h-8 w-8 rounded-full shrink-0"
                aria-label="Regenerate invite code"
              >
                <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        )}

        {/* Members list */}
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1 py-2">
            {members.map((member) => {
              const isSelf = member.user_id === user?.id;
              const memberIsAdmin = member.role === 'admin';
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-sm)]"
                >
                  <div className="h-8 w-8 rounded-full bg-[var(--bg-active)] flex items-center justify-center text-[13px] font-semibold text-[var(--text-secondary)] shrink-0">
                    {member.user_id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[14px] text-[var(--text-primary)] truncate block">
                      {isSelf ? 'You' : member.display_name || member.user_id.slice(0, 8)}
                    </span>
                  </div>
                  {memberIsAdmin && (
                    <Badge variant="secondary" className="text-[11px] gap-1 py-0 shrink-0">
                      <Shield className="h-3 w-3" />
                      Admin
                    </Badge>
                  )}
                  {isAdmin && !isSelf && (
                    <RoleToggle
                      currentRole={member.role}
                      onChangeRole={(role) => handleRoleChange(member.user_id, role)}
                    />
                  )}
                  {isAdmin && !isSelf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-[var(--destructive)] shrink-0"
                      onClick={() => handleRemoveMember(member.user_id)}
                      aria-label="Remove member"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Leave button for non-admins */}
        {!isAdmin && (
          <Button
            variant="outline"
            onClick={handleLeave}
            className="w-full rounded-[var(--radius-sm)] text-[var(--destructive)]"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Leave Location
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoleToggle({ currentRole, onChangeRole }: { currentRole: string; onChangeRole: (role: 'admin' | 'member') => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, reposition]);

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        {currentRole === 'admin' ? 'Admin' : 'Member'}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[120px] glass-heavy rounded-[var(--radius-lg)] py-1 shadow-lg border border-[var(--border-glass)]"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}
        >
          <button
            onClick={() => { setOpen(false); if (currentRole !== 'admin') onChangeRole('admin'); }}
            className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${currentRole === 'admin' ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
          >
            Admin
          </button>
          <button
            onClick={() => { setOpen(false); if (currentRole !== 'member') onChangeRole('member'); }}
            className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${currentRole === 'member' ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
          >
            Member
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
