import { Globe, Lock, Mail, Search, UserPlus, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { type AdminUser, capitalize, useAdminUsers } from './useAdminUsers';

const PAGE_SIZE = 25;

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
    <div className="page-content-wide">
      <PageHeader title="Admin" back />

      {/* Registration — disclosure, collapsed by default */}
      <div className="flat-card rounded-[var(--radius-lg)] px-3 py-1">
      <Disclosure
        label={
          <span className="flex items-center gap-2">
            {registration.locked ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
            <span>Registration</span>
            <Badge variant="secondary" className="text-[11px]">{capitalize(registration.mode)}</Badge>
          </span>
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
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

      {/* Cloud Metrics — single component for all sizes */}
      {!isSelfHosted && <AdminMetricsSection />}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--text-secondary)]" />
        <span className="text-[15px] font-semibold text-[var(--text-primary)]">Users</span>
        <Badge variant="secondary" className="text-[11px]">{count}</Badge>
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

      {/* Users table — responsive, single rendering path */}
      {isLoading ? (
        <div className="flat-card rounded-[var(--radius-lg)] overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--bg-hover)] border-b-2 border-[var(--border-flat)]">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12 hidden lg:block" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-10" />
            <div className="flex-1" />
            <Skeleton className="h-3 w-14" />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
            <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-[var(--border-subtle)]">
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-12 hidden lg:block" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-5 w-14" />
              <div className="flex-1" />
              <Skeleton className="h-3 w-16" />
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

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={count}
        pageSize={PAGE_SIZE}
        itemLabel="users"
      />

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

      {/* Create user dialog */}
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
