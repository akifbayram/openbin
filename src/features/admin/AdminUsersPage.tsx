import { Globe, Lock, Mail, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import type { SortDirection } from '@/components/ui/sort-header';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/usePlan';
import { AdminMetricsSection } from './AdminMetricsSection';
import { AdminUsersTable } from './AdminUsersTable';
import { useAdminMetrics } from './useAdminMetrics';
import { type AdminUser, capitalize, statusVariant, useAdminUsers } from './useAdminUsers';

const PAGE_SIZE = 25;

function UserRow({
  u,
  currentUserId,
  onDelete,
  onClickUser,
}: {
  u: AdminUser;
  currentUserId: string;
  onDelete: (u: AdminUser) => void;
  onClickUser: (id: string) => void;
}) {
  const isSelf = u.id === currentUserId;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] transition-colors">
      <button type="button" className="flex-1 min-w-0 text-left cursor-pointer appearance-none bg-transparent border-none p-0 font-[inherit]" onClick={() => onClickUser(u.id)}>
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
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        {u.deletedAt && <Badge variant="destructive" className="text-[11px]">Deleted</Badge>}
        <Badge variant={statusVariant(u.status)} className="text-[11px]">{capitalize(u.status)}</Badge>
        <Badge variant="secondary" className="text-[11px]">{capitalize(u.plan)}</Badge>
        <span className="text-[12px] text-[var(--text-muted)]">{new Date(u.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
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
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<'username' | 'email' | 'plan' | 'status' | 'bins' | 'locations' | 'storage' | 'created'>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', password: '', displayName: '', email: '', isAdmin: false });
  const [createLoading, setCreateLoading] = useState(false);

  const sortParam = `${sortDirection === 'desc' ? '-' : ''}${sortColumn}`;
  const { users, count, isLoading, registration, deleteUser, updateRegistrationMode, createUser } = useAdminUsers(search, page, sortParam);
  const { metrics } = useAdminMetrics();
  const totalPages = Math.ceil(count / PAGE_SIZE);

  const handleSort = useCallback((column: typeof sortColumn, direction: SortDirection) => {
    setSortColumn(column);
    setSortDirection(direction);
    setPage(1);
  }, []);

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

  const handleCreate = useCallback(async () => {
    setCreateLoading(true);
    try {
      await createUser({
        username: createForm.username,
        password: createForm.password,
        displayName: createForm.displayName || undefined,
        email: createForm.email || undefined,
        isAdmin: createForm.isAdmin,
      });
      showToast({ message: `User ${createForm.username} created`, variant: 'success' });
      setCreateOpen(false);
      setCreateForm({ username: '', password: '', displayName: '', email: '', isAdmin: false });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create user', variant: 'error' });
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, createUser, showToast]);

  return (
    <div className="page-content max-w-7xl">
      <PageHeader title="Admin" back />

      {/* Registration — disclosure on desktop, full card on mobile */}
      <div className="hidden lg:block">
        <Disclosure
          label={
            <span className="flex items-center gap-2">
              {registration.locked ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
              <span>Registration</span>
              <Badge variant="secondary" className="text-[11px]">{capitalize(registration.mode)}</Badge>
            </span>
          }
        >
          <div className="flex items-center gap-3 pt-1">
            <OptionGroup
              options={[
                { key: 'open' as const, label: 'Open', icon: UserPlus, disabled: registration.locked, disabledTitle: 'Locked by env var' },
                { key: 'invite' as const, label: 'Invite', icon: Mail, disabled: registration.locked, disabledTitle: 'Locked by env var' },
                { key: 'closed' as const, label: 'Closed', icon: Lock, disabled: registration.locked, disabledTitle: 'Locked by env var' },
              ]}
              value={registration.mode}
              onChange={handleRegistrationChange}
            />
            {registration.locked && (
              <span className="text-[12px] text-[var(--text-tertiary)]">Locked by REGISTRATION_MODE env var</span>
            )}
          </div>
        </Disclosure>
      </div>
      <div className="lg:hidden">
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
      </div>

      {/* Metrics — inline strip on desktop, card on mobile (cloud only) */}
      {!isSelfHosted && (
        <>
          {metrics && (
            <div className="hidden lg:flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[120px] p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Total Users</span>
                <p className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{metrics.plans.total}</p>
              </div>
              <div className="flex-1 min-w-[120px] p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Pro Active</span>
                <p className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{metrics.plans.proActive}</p>
              </div>
              <div className="flex-1 min-w-[120px] p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Pro Trial</span>
                <p className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{metrics.plans.proTrial}</p>
              </div>
              <div className="flex-1 min-w-[120px] p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Lite Active</span>
                <p className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{metrics.plans.liteActive}</p>
              </div>
              <div className="flex-1 min-w-[120px] p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Trial Conv.</span>
                <p className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{metrics.trialConversion.rate}%</p>
                <span className="text-[12px] text-[var(--text-muted)]">{metrics.trialConversion.converted}/{metrics.trialConversion.started}</span>
              </div>
            </div>
          )}
          <div className="lg:hidden">
            <AdminMetricsSection />
          </div>
        </>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--text-secondary)] hidden lg:block" />
        <span className="text-[15px] font-semibold text-[var(--text-primary)] hidden lg:block">Users</span>
        <Badge variant="secondary" className="text-[11px] hidden lg:inline-flex">{count}</Badge>
        <div className="flex-1">
          <SearchInput
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            onClear={search ? () => { setSearch(''); setPage(1); } : undefined}
            containerClassName="max-w-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Create User
        </Button>
      </div>

      {/* Desktop: sortable table */}
      <div className="hidden lg:block">
        {isLoading ? (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 8 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
              <Skeleton key={i} className="h-12 w-full" />
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
          <AdminUsersTable
            users={users}
            currentUserId={user?.id ?? ''}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onDelete={setDeleteTarget}
            onClickUser={(id) => navigate(`/admin/users/${id}`)}
          />
        )}
      </div>

      {/* Mobile: card list */}
      <div className="lg:hidden">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-[15px] font-semibold text-[var(--text-primary)]">Users</span>
              <Badge variant="secondary" className="text-[11px]">{count}</Badge>
            </div>
            <div className="divide-y divide-[var(--border-flat)]">
              {isLoading ? (
                <div className="flex flex-col gap-1 py-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
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
                    currentUserId={user?.id ?? ''}
                    onDelete={setDeleteTarget}
                    onClickUser={(id) => navigate(`/admin/users/${id}`)}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={count}
        pageSize={PAGE_SIZE}
        itemLabel="users"
      />

      {/* Delete confirmation dialog — keep unchanged */}
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

      {/* Create user dialog — keep unchanged */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateOpen(false);
          setCreateForm({ username: '', password: '', displayName: '', email: '', isAdmin: false });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-5">
            <FormField label="Username" htmlFor="create-username">
              <Input
                id="create-username"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="Username"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Password" htmlFor="create-password" hint="8+ characters, mixed case, one digit">
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Password"
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Display Name" htmlFor="create-displayName">
              <Input
                id="create-displayName"
                value={createForm.displayName}
                onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Email" htmlFor="create-email">
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch
                checked={createForm.isAdmin}
                onCheckedChange={(checked) => setCreateForm((f) => ({ ...f, isAdmin: checked }))}
              />
              <Label>Admin</Label>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!createForm.username || !createForm.password || createLoading}>
                {createLoading ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
