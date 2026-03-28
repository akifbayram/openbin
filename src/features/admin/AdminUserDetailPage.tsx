import {
  Shield,
  ShieldOff,
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
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { capitalize, deleteUser, statusVariant, updateUser, useAdminCount, useAdminUserDetail } from './useAdminUsers';

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

  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (notFound) navigate('/admin/users');
  }, [notFound, navigate]);

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

  const handleToggleStatus = useCallback(async () => {
    if (!detail) return;
    const newStatus = detail.status === 'active' ? 0 : 1;
    try {
      await updateUser(detail.id, { subStatus: newStatus });
      showToast({ message: `User ${newStatus === 1 ? 'activated' : 'deactivated'}`, variant: 'success' });
      refresh();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update user', variant: 'error' });
    }
  }, [detail, showToast, refresh]);

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
  const statusDisabled = isLastAdmin;

  return (
    <div className="page-content">
      <PageHeader
        title={detail.displayName || detail.username}
        back
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
                {detail.isAdmin && <Badge variant="default">Admin</Badge>}
                <Badge variant="secondary">{capitalize(detail.plan)}</Badge>
                <Badge variant={statusVariant(detail.status)}>{capitalize(detail.status)}</Badge>
              </div>
            </div>
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

            {detail.status !== 'trial' && (
              <div className="flex items-center justify-between py-3">
                <span className="text-[14px] text-[var(--text-secondary)]">
                  {detail.status === 'active' ? 'Deactivate user' : 'Activate user'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleStatus}
                  disabled={statusDisabled}
                >
                  {detail.status === 'active' ? <ShieldOff className="h-3.5 w-3.5 mr-1.5" /> : <Shield className="h-3.5 w-3.5 mr-1.5" />}
                  {detail.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            )}

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
    </div>
  );
}
