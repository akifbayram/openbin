import {
  KeyRound,
  Mail,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/usePlan';
import { cn } from '@/lib/utils';
import { capitalize, deleteUser, regenerateApiKey, sendPasswordReset, statusVariant, updateUser, useAdminCount, useAdminUserDetail } from './useAdminUsers';

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
      <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">{label}</span>
      <span className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{value}</span>
    </div>
  );
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const { adminCount, refresh: refreshAdminCount } = useAdminCount();
  const { detail, isLoading, notFound, refresh } = useAdminUserDetail(id ?? '');
  const { planInfo } = usePlan();

  // Redirect non-admins
  useEffect(() => {
    if (currentUser && !currentUser.isAdmin) navigate('/', { replace: true });
  }, [currentUser, navigate]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenKeyOpen, setRegenKeyOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<'lite' | 'pro' | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'inactive' | 'trial' | 'active' | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', displayName: '', password: '' });
  const [activeUntilInput, setActiveUntilInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (notFound) navigate('/admin/users');
  }, [notFound, navigate]);

  useEffect(() => {
    if (detail) setActiveUntilInput(detail.activeUntil ? detail.activeUntil.slice(0, 16) : '');
  }, [detail]);

  const handleSaveActiveUntil = useCallback(async () => {
    if (!detail) return;
    try {
      await updateUser(detail.id, { activeUntil: activeUntilInput ? new Date(activeUntilInput).toISOString() : null });
      showToast({ message: 'Active until updated', variant: 'success' });
      refresh();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update active until', variant: 'error' });
    }
  }, [detail, activeUntilInput, showToast, refresh]);

  const handleToggleAdmin = useCallback(async (isAdmin: boolean) => {
    if (!detail) return;
    try {
      await updateUser(detail.id, { isAdmin });
      showToast({ message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin`, variant: 'success' });
      refresh();
      refreshAdminCount();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update user', variant: 'error' });
    }
  }, [detail, showToast, refresh, refreshAdminCount]);

  const handleDelete = useCallback(async () => {
    if (!detail) return;
    try {
      await deleteUser(detail.id);
      showToast({ message: `User ${detail.username} deleted`, variant: 'success' });
      navigate('/admin/users');
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete user', variant: 'error' });
    }
  }, [detail, showToast, navigate]);

  const handlePlanChange = useCallback((newPlan: 'lite' | 'pro') => {
    if (!detail || newPlan === detail.plan) return;
    setPendingPlan(newPlan);
  }, [detail]);

  const confirmPlanChange = useCallback(async () => {
    if (!detail || !pendingPlan) return;
    try {
      await updateUser(detail.id, { plan: pendingPlan === 'pro' ? 1 : 0 });
      showToast({ message: `Plan changed to ${pendingPlan}`, variant: 'success' });
      refresh();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update plan', variant: 'error' });
    } finally {
      setPendingPlan(null);
    }
  }, [detail, pendingPlan, showToast, refresh]);

  const handleStatusChange = useCallback((newStatus: 'inactive' | 'trial' | 'active') => {
    if (!detail || newStatus === detail.status) return;
    setPendingStatus(newStatus);
  }, [detail]);

  const confirmStatusChange = useCallback(async () => {
    if (!detail || !pendingStatus) return;
    const statusMap = { inactive: 0, active: 1, trial: 2 } as const;
    try {
      await updateUser(detail.id, { subStatus: statusMap[pendingStatus] });
      showToast({ message: `Status changed to ${pendingStatus}`, variant: 'success' });
      refresh();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update status', variant: 'error' });
    } finally {
      setPendingStatus(null);
    }
  }, [detail, pendingStatus, showToast, refresh]);

  const openEdit = useCallback(() => {
    if (!detail) return;
    setEditForm({ email: detail.email || '', displayName: detail.displayName || '', password: '' });
    setEditOpen(true);
  }, [detail]);

  const handleEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const body: Record<string, string> = {};
    if (editForm.email !== (detail.email || '')) body.email = editForm.email;
    if (editForm.displayName !== (detail.displayName || '')) body.displayName = editForm.displayName;
    if (editForm.password) body.password = editForm.password;
    if (Object.keys(body).length === 0) { setEditOpen(false); return; }
    setSaving(true);
    try {
      await updateUser(detail.id, body);
      showToast({ message: 'User updated', variant: 'success' });
      refresh();
      setEditOpen(false);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update user', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [detail, editForm, showToast, refresh]);

  const handleRegenerateApiKey = useCallback(async () => {
    if (!detail) return;
    try {
      const result = await regenerateApiKey(detail.id);
      showToast({ message: `New API key: ${result.keyPrefix}...`, variant: 'success' });
      refresh();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to regenerate API key', variant: 'error' });
    } finally {
      setRegenKeyOpen(false);
    }
  }, [detail, showToast, refresh]);

  const handleSendPasswordReset = useCallback(async () => {
    if (!detail) return;
    try {
      await sendPasswordReset(detail.id);
      showToast({ message: 'Password reset email sent', variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to send password reset', variant: 'error' });
    }
  }, [detail, showToast]);

  // Prevent flash of admin content for non-admins
  if (currentUser && !currentUser.isAdmin) return null;

  if (isLoading) {
    return (
      <div className="page-content">
        <PageHeader title="" back />
        <Card>
          <CardContent>
            <Skeleton className="h-4 w-20 mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Skeleton className="h-4 w-14 mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
                <div key={i} className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
                  <Skeleton className="h-3 w-14 mb-1" />
                  <Skeleton className="h-5 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!detail) return null;

  const isSelf = detail.id === currentUser?.id;
  const isLastAdmin = detail.isAdmin && adminCount <= 1;
  const adminDisabled = isSelf || isLastAdmin;
  const savedActiveUntil = detail.activeUntil ? detail.activeUntil.slice(0, 16) : '';

  return (
    <div className="page-content">
      <PageHeader
        title={detail.displayName || detail.username}
        back
        backTo="/admin/users"
      />

      {/* Identity */}
      <Card>
        <CardContent>
          <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">Identity</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Username</span>
              <p className="text-[15px] text-[var(--text-primary)]">@{detail.username}</p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Display Name</span>
              <p className="text-[15px] text-[var(--text-primary)]">{detail.displayName || '—'}</p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Email</span>
              <p className="text-[15px] text-[var(--text-primary)]">{detail.email || '—'}</p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Status</span>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {detail.deletedAt && <Badge variant="destructive">Deleted</Badge>}
                {detail.isAdmin && <Badge variant="default">Admin</Badge>}
                <Badge variant="secondary">{capitalize(detail.plan)}</Badge>
                <Badge variant={statusVariant(detail.status)}>{capitalize(detail.status)}</Badge>
              </div>
            </div>
            {!planInfo.selfHosted && (
              <div>
                <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Active Until</span>
                <p className="text-[15px] text-[var(--text-primary)]">{detail.activeUntil ? new Date(detail.activeUntil).toLocaleString() : '—'}</p>
              </div>
            )}
            <div>
              <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Created</span>
              <p className="text-[15px] text-[var(--text-primary)]">{new Date(detail.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">Updated</span>
              <p className="text-[15px] text-[var(--text-primary)]">{new Date(detail.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardContent>
          <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">Stats</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <StatItem label="Locations" value={detail.stats.locationCount} />
            <StatItem label="Bins" value={detail.stats.binCount} />
            <StatItem label="Photos" value={detail.stats.photoCount} />
            <StatItem label="Storage (MB)" value={detail.stats.photoStorageMb} />
            <StatItem label="API Keys" value={detail.stats.apiKeyCount} />
            <StatItem label="Shares" value={detail.stats.shareCount} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent>
          <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">Actions</p>
          <div className="flex flex-col divide-y divide-[var(--border-flat)]">
            <div className="flex items-center justify-between py-3 first:pt-0">
              <span className="text-[14px] text-[var(--text-secondary)]">Admin role</span>
              <span className={cn('flex items-center gap-1.5', adminDisabled && 'opacity-50')}>
                <Switch
                  checked={detail.isAdmin}
                  onCheckedChange={handleToggleAdmin}
                  disabled={adminDisabled}
                />
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-[14px] text-[var(--text-secondary)]">Edit details</span>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </div>

            {!planInfo.selfHosted && (
              <div className="flex items-center justify-between py-3">
                <span className="text-[14px] text-[var(--text-secondary)]">Plan tier</span>
                <OptionGroup
                  options={[
                    { key: 'lite' as const, label: 'Lite' },
                    { key: 'pro' as const, label: 'Pro' },
                  ]}
                  value={detail.plan}
                  onChange={handlePlanChange}
                  size="sm"
                />
              </div>
            )}

            {!planInfo.selfHosted && (
              <div className="flex items-center justify-between py-3">
                <span className="text-[14px] text-[var(--text-secondary)]">Subscription</span>
                <OptionGroup
                  options={[
                    { key: 'inactive' as const, label: 'Inactive' },
                    { key: 'trial' as const, label: 'Trial' },
                    { key: 'active' as const, label: 'Active' },
                  ]}
                  value={detail.status}
                  onChange={handleStatusChange}
                  size="sm"
                />
              </div>
            )}

            {!planInfo.selfHosted && (
              <div className="flex items-center justify-between py-3">
                <span className="text-[14px] text-[var(--text-secondary)]">Active until</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={activeUntilInput}
                    onChange={(e) => setActiveUntilInput(e.target.value)}
                    className="w-auto text-[14px] h-8"
                  />
                  {activeUntilInput !== savedActiveUntil && (
                    <Button size="sm" onClick={handleSaveActiveUntil}>Save</Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-3">
              <span className="text-[14px] text-[var(--text-secondary)]">Regenerate API key</span>
              <Button variant="outline" size="sm" onClick={() => setRegenKeyOpen(true)}>
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                Regenerate
              </Button>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-[14px] text-[var(--text-secondary)]">Send password reset</span>
              <Button variant="outline" size="sm" onClick={handleSendPasswordReset} disabled={!detail.email}>
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Send Reset
              </Button>
            </div>

            <div className="flex items-center justify-between py-3 last:pb-0">
              <span className="text-[14px] text-[var(--text-secondary)]">Delete user</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={isSelf}
                className="text-[var(--destructive)] hover:text-[var(--destructive)]"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{detail.username}</strong>? This cannot be undone. All their data will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate API key confirmation dialog */}
      <Dialog open={regenKeyOpen} onOpenChange={(open) => !open && setRegenKeyOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate API Key</DialogTitle>
            <DialogDescription>
              This will revoke all existing API keys for <strong>{detail.username}</strong> and create a new one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenKeyOpen(false)}>Cancel</Button>
            <Button onClick={handleRegenerateApiKey}>Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan change confirmation dialog */}
      <Dialog open={pendingPlan !== null} onOpenChange={(open) => { if (!open) setPendingPlan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Change <strong>{detail.username}</strong>&apos;s plan from {capitalize(detail.plan)} to {pendingPlan ? capitalize(pendingPlan) : ''}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPlan(null)}>Cancel</Button>
            <Button onClick={confirmPlanChange}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change confirmation dialog */}
      <Dialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) setPendingStatus(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Status</DialogTitle>
            <DialogDescription>
              Change <strong>{detail.username}</strong>&apos;s status from {capitalize(detail.status)} to {pendingStatus ? capitalize(pendingStatus) : ''}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)}>Cancel</Button>
            <Button onClick={confirmStatusChange}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => !open && setEditOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Display Name</Label>
              <Input
                id="edit-displayName"
                value={editForm.displayName}
                onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password</Label>
              <Input
                id="edit-password"
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to keep current"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
