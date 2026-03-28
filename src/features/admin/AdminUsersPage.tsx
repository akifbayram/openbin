import { Globe, Lock, Mail, Search, Shield, ShieldOff, Trash2, UserPlus, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/usePlan';
import { cn } from '@/lib/utils';
import { AdminMetricsSection } from './AdminMetricsSection';
import { type AdminUser, useAdminUsers } from './useAdminUsers';

const PAGE_SIZE = 25;

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'trial') return 'outline';
  return 'secondary';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function UserRow({
  u,
  currentUserId,
  adminCount,
  onToggleAdmin,
  onToggleStatus,
  onDelete,
}: {
  u: AdminUser;
  currentUserId: string;
  adminCount: number;
  onToggleAdmin: (id: string, isAdmin: boolean) => void;
  onToggleStatus: (id: string, subStatus: number) => void;
  onDelete: (u: AdminUser) => void;
}) {
  const isSelf = u.id === currentUserId;
  const isLastAdmin = u.isAdmin && adminCount <= 1;
  const adminDisabled = isSelf || isLastAdmin;
  const statusDisabled = isLastAdmin;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium text-[var(--text-primary)] truncate">{u.displayName || u.username}</span>
          {u.isAdmin && <Badge variant="default" className="text-[11px] px-1.5 py-0">Admin</Badge>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[13px] text-[var(--text-tertiary)]">@{u.username}</span>
          {u.email && (
            <span className="text-[13px] text-[var(--text-tertiary)] flex items-center gap-0.5 truncate">
              <Mail className="h-3 w-3 shrink-0" />{u.email}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={statusVariant(u.status)} className="text-[11px]">{capitalize(u.status)}</Badge>
        <Badge variant="secondary" className="text-[11px]">{capitalize(u.plan)}</Badge>
        <span className="text-[12px] text-[var(--text-muted)]">{new Date(u.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className={cn('flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] mr-1', adminDisabled && 'opacity-50')}>
          <Switch
            checked={u.isAdmin}
            onCheckedChange={(checked) => onToggleAdmin(u.id, checked)}
            disabled={adminDisabled}
          />
          Admin
        </span>

        {u.status !== 'trial' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleStatus(u.id, u.status === 'active' ? 0 : 1)}
            disabled={statusDisabled}
            aria-label={u.status === 'active' ? 'Deactivate user' : 'Activate user'}
          >
            {u.status === 'active' ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(u)}
          disabled={isSelf}
          aria-label="Delete user"
          className="text-[var(--destructive)] hover:text-[var(--destructive)]"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const { user } = useAuth();
  const { isSelfHosted } = usePlan();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const { users, count, adminCount, isLoading, registration, updateUser, deleteUser, updateRegistrationMode } = useAdminUsers(search, page);
  const totalPages = Math.ceil(count / PAGE_SIZE);

  const handleToggleAdmin = useCallback(async (id: string, isAdmin: boolean) => {
    try {
      await updateUser(id, { isAdmin });
      showToast({ message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin`, variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update user', variant: 'error' });
    }
  }, [updateUser, showToast]);

  const handleToggleStatus = useCallback(async (id: string, subStatus: number) => {
    try {
      await updateUser(id, { subStatus });
      showToast({ message: `User ${subStatus === 1 ? 'activated' : 'deactivated'}`, variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update user', variant: 'error' });
    }
  }, [updateUser, showToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      showToast({ message: `User ${deleteTarget.username} deleted`, variant: 'success' });
      setDeleteTarget(null);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete user', variant: 'error' });
    }
  }, [deleteTarget, deleteUser, showToast]);

  const handleRegistrationChange = useCallback(async (mode: string) => {
    try {
      await updateRegistrationMode(mode as 'open' | 'invite' | 'closed');
      showToast({ message: `Registration mode set to ${mode}`, variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update registration mode', variant: 'error' });
    }
  }, [updateRegistrationMode, showToast]);

  return (
    <div className="page-content">
      <PageHeader title="Admin" back />

      {/* Registration Mode */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                {registration.locked ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                Registration
              </p>
              {registration.locked && (
                <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">Locked by REGISTRATION_MODE env var</p>
              )}
            </div>
            <OptionGroup
              options={[
                { key: 'open' as const, label: 'Open', icon: UserPlus, disabled: registration.locked, disabledTitle: 'Locked by env var' },
                { key: 'invite' as const, label: 'Invite', icon: Mail, disabled: registration.locked, disabledTitle: 'Locked by env var' },
                { key: 'closed' as const, label: 'Closed', icon: Lock, disabled: registration.locked, disabledTitle: 'Locked by env var' },
              ]}
              value={registration.mode}
              onChange={handleRegistrationChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cloud Metrics */}
      {!isSelfHosted && <AdminMetricsSection />}

      {/* Users */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-[15px] font-semibold text-[var(--text-primary)]">Users</span>
            <Badge variant="secondary" className="text-[11px]">{count}</Badge>
          </div>

          <SearchInput
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            onClear={search ? () => { setSearch(''); setPage(1); } : undefined}
          />

          <div className="mt-3 divide-y divide-[var(--border-flat)]">
            {isLoading ? (
              <div className="flex flex-col gap-1 py-1">
                {Array.from({ length: 5 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
                  <div key={i} className="flex items-center gap-3 px-3 py-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-tertiary)]">
                <Search className="h-10 w-10 opacity-25" />
                <div className="text-center space-y-1">
                  <p className="text-[17px] font-semibold text-[var(--text-secondary)]">No users found</p>
                  {search && <p className="text-[13px]">Try a different search term</p>}
                </div>
              </div>
            ) : (
              users.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  currentUserId={user!.id}
                  adminCount={adminCount}
                  onToggleAdmin={handleToggleAdmin}
                  onToggleStatus={handleToggleStatus}
                  onDelete={setDeleteTarget}
                />
              ))
            )}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalCount={count}
            pageSize={PAGE_SIZE}
            itemLabel="users"
          />
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteTarget?.username}</strong>? This cannot be undone. All their data will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
