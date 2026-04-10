import {
  MapPin,
  Plus,
  Search,
  Server,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { OptionGroup } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { getErrorMessage, relativeTime } from '@/lib/utils';
import {
  fetchMaintenanceStatus,
  fetchSystemHealth,
  type MaintenanceStatus,
  type SystemHealth,
  toggleMaintenance,
  useAdminLocations,
  useAnnouncements,
  useAuditLog,
} from './useAdminSystem';

type Tab = 'system' | 'audit' | 'locations';

const PAGE_SIZE = 25;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function HealthCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
      <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">{label}</span>
      <span className="text-[20px] font-bold text-[var(--text-primary)] leading-tight tabular-nums">{value}</span>
    </div>
  );
}

// ── System Tab ──────────────────────────────────────────────────────

function SystemTab() {
  const { showToast } = useToast();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [loadingHealth, setLoadingHealth] = useState(true);

  const { announcements, isLoading: announcementsLoading, createAnnouncement, deleteAnnouncement } = useAnnouncements();
  const [newBannerOpen, setNewBannerOpen] = useState(false);
  const [bannerForm, setBannerForm] = useState({ text: '', type: 'info' as 'info' | 'warning' | 'critical' });
  const [bannerSaving, setBannerSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchSystemHealth(), fetchMaintenanceStatus()])
      .then(([h, m]) => {
        setHealth(h);
        setMaintenance(m);
        setMaintenanceMsg(m.message || '');
      })
      .catch((err) => {
        showToast({ message: getErrorMessage(err, 'Failed to load system status'), variant: 'error' });
      })
      .finally(() => setLoadingHealth(false));
  }, [showToast]);

  const handleToggleMaintenance = useCallback(async (enabled: boolean) => {
    try {
      const result = await toggleMaintenance(enabled, maintenanceMsg || undefined);
      setMaintenance(result);
      showToast({ message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to toggle maintenance'), variant: 'error' });
    }
  }, [maintenanceMsg, showToast]);

  const handleCreateBanner = useCallback(async () => {
    if (!bannerForm.text.trim()) return;
    setBannerSaving(true);
    try {
      await createAnnouncement({ text: bannerForm.text, type: bannerForm.type });
      showToast({ message: 'Announcement created', variant: 'success' });
      setNewBannerOpen(false);
      setBannerForm({ text: '', type: 'info' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to create announcement'), variant: 'error' });
    } finally {
      setBannerSaving(false);
    }
  }, [bannerForm, createAnnouncement, showToast]);

  const handleDeleteBanner = useCallback(async (id: string) => {
    try {
      await deleteAnnouncement(id);
      showToast({ message: 'Announcement deleted', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to delete announcement'), variant: 'error' });
    }
  }, [deleteAnnouncement, showToast]);

  if (loadingHealth) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
              <div key={i} className="flex flex-col gap-1.5 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Health */}
      {health && (
        <Card>
          <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <HealthCard label="DB Size" value={formatBytes(health.dbSizeBytes)} />
              <HealthCard label="Total Users" value={health.userCount.total} />
              <HealthCard label="Active Users" value={health.userCount.active} />
              <HealthCard label="Deleted Users" value={health.userCount.deleted} />
              <HealthCard label="Suspended Users" value={health.userCount.suspended} />
              <HealthCard label="Active Sessions" value={health.activeSessions} />
              <HealthCard label="Uptime" value={formatUptime(health.uptime)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance */}
      <Card>
        <CardHeader><CardTitle>Maintenance Mode</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="row-spread">
              <div>
                <span className="text-[14px] text-[var(--text-secondary)]">Maintenance mode</span>
                {maintenance?.enabled && (
                  <p className="text-[12px] text-[var(--color-warning)]">Currently active</p>
                )}
              </div>
              <Switch
                checked={maintenance?.enabled ?? false}
                onCheckedChange={handleToggleMaintenance}
              />
            </div>
            <FormField label="Message (shown to users)" htmlFor="maint-msg">
              <Input
                id="maint-msg"
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                placeholder="We are performing scheduled maintenance..."
                className="text-[14px]"
              />
            </FormField>
            {maintenanceMsg !== (maintenance?.message || '') && (
              <Button size="sm" className="self-start" onClick={() => handleToggleMaintenance(maintenance?.enabled ?? false)}>
                Update Message
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Announcements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Announcements</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setNewBannerOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {announcementsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <p className="text-[14px] text-[var(--text-tertiary)] py-2">No active announcements.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
              {announcements.map((a) => (
                <div key={a.id} className="row-spread py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={a.type === 'critical' ? 'destructive' : a.type === 'warning' ? 'outline' : 'secondary'} className="text-[11px] shrink-0">
                      {a.type}
                    </Badge>
                    <span className="text-[14px] text-[var(--text-primary)] truncate">{a.text}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteBanner(a.id)}
                    aria-label="Delete announcement"
                    className="text-[var(--destructive)] hover:text-[var(--destructive)] shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create announcement dialog */}
      <Dialog open={newBannerOpen} onOpenChange={(open) => !open && setNewBannerOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>Create a banner announcement visible to all users.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Type" htmlFor="banner-type">
              <OptionGroup
                options={[
                  { key: 'info' as const, label: 'Info' },
                  { key: 'warning' as const, label: 'Warning' },
                  { key: 'critical' as const, label: 'Critical' },
                ]}
                value={bannerForm.type}
                onChange={(type) => setBannerForm(f => ({ ...f, type }))}
                size="sm"
              />
            </FormField>
            <FormField label="Message" htmlFor="banner-text">
              <Textarea
                id="banner-text"
                value={bannerForm.text}
                onChange={(e) => setBannerForm(f => ({ ...f, text: e.target.value }))}
                placeholder="Announcement text..."
                rows={3}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBannerOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBanner} disabled={!bannerForm.text.trim() || bannerSaving}>
              {bannerSaving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Audit Log Tab ───────────────────────────────────────────────────

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const { entries, count, isLoading } = useAuditLog(page, { action: actionFilter || undefined });
  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <>
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder="Filter by action..."
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          onClear={actionFilter ? () => { setActionFilter(''); setPage(1); } : undefined}
          className="flex-1"
        />
      </div>

      {isLoading ? (
        <Table>
          <TableHeader>
            <div className="w-28"><Skeleton className="h-3 w-10" /></div>
            <div className="w-24"><Skeleton className="h-3 w-10" /></div>
            <div className="w-28"><Skeleton className="h-3 w-12" /></div>
            <div className="flex-1"><Skeleton className="h-3 w-10" /></div>
            <div className="hidden lg:block flex-1"><Skeleton className="h-3 w-12" /></div>
          </TableHeader>
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)]">
              <div className="w-28"><Skeleton className="h-4 w-20" /></div>
              <div className="w-24"><Skeleton className="h-4 w-16" /></div>
              <div className="w-28"><Skeleton className="h-4 w-20" /></div>
              <div className="flex-1"><Skeleton className="h-4 w-24" /></div>
              <div className="hidden lg:block flex-1"><Skeleton className="h-4 w-16" /></div>
            </div>
          ))}
        </Table>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No audit entries found"
          subtitle={actionFilter ? 'Try a different filter' : undefined}
          variant="search"
        />
      ) : (
        <Table>
          <TableHeader>
            <div className="w-28">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Time</span>
            </div>
            <div className="w-24">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Actor</span>
            </div>
            <div className="w-28">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Action</span>
            </div>
            <div className="flex-1">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Target</span>
            </div>
            <div className="hidden lg:block flex-1">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Details</span>
            </div>
          </TableHeader>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="cursor-default [@media(hover:hover)]:hover:bg-[var(--bg-hover)]">
              <div className="w-28">
                <span className="text-[12px] text-[var(--text-tertiary)] whitespace-nowrap">{relativeTime(entry.createdAt)}</span>
              </div>
              <div className="w-24 truncate">
                <span className="text-[14px] text-[var(--text-secondary)]">{entry.actorName}</span>
              </div>
              <div className="w-28">
                <Badge variant="secondary" className="text-[11px]">{entry.action}</Badge>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[14px] text-[var(--text-primary)] truncate block">
                  {entry.targetName || entry.targetId || '—'}
                </span>
                {entry.targetType && (
                  <span className="text-[12px] text-[var(--text-tertiary)]">{entry.targetType}</span>
                )}
              </div>
              <div className="hidden lg:block flex-1 min-w-0">
                <span className="text-[12px] text-[var(--text-tertiary)] truncate block">
                  {entry.details ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(', ') : '—'}
                </span>
              </div>
            </TableRow>
          ))}
        </Table>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={count}
        pageSize={PAGE_SIZE}
        itemLabel="entries"
      />
    </>
  );
}

// ── Locations Tab ───────────────────────────────────────────────────

function LocationsTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { locations, count, isLoading } = useAdminLocations(search, page);
  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <>
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder="Search locations..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          onClear={search ? () => { setSearch(''); setPage(1); } : undefined}
          className="flex-1"
        />
        <Badge variant="secondary" className="text-[11px]">{count}</Badge>
      </div>

      {isLoading ? (
        <Table>
          <TableHeader>
            <div className="flex-1"><Skeleton className="h-3 w-12" /></div>
            <div className="w-24"><Skeleton className="h-3 w-10" /></div>
            <div className="hidden sm:block w-16"><Skeleton className="h-3 w-10" /></div>
            <div className="hidden sm:block w-14"><Skeleton className="h-3 w-8" /></div>
            <div className="hidden lg:block w-14"><Skeleton className="h-3 w-10" /></div>
            <div className="hidden sm:block w-24"><Skeleton className="h-3 w-14" /></div>
          </TableHeader>
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)]">
              <div className="flex-1 min-w-0"><Skeleton className="h-4 w-28" /></div>
              <div className="w-24"><Skeleton className="h-4 w-16" /></div>
              <div className="hidden sm:block w-16"><Skeleton className="h-4 w-8" /></div>
              <div className="hidden sm:block w-14"><Skeleton className="h-4 w-8" /></div>
              <div className="hidden lg:block w-14"><Skeleton className="h-4 w-8" /></div>
              <div className="hidden sm:block w-24"><Skeleton className="h-3 w-16" /></div>
            </div>
          ))}
        </Table>
      ) : locations.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No locations found"
          subtitle={search ? 'Try a different search term' : undefined}
          variant="search"
        />
      ) : (
        <Table>
          <TableHeader>
            <div className="flex-1">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Name</span>
            </div>
            <div className="w-24">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Owner</span>
            </div>
            <div className="hidden sm:block w-16">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Members</span>
            </div>
            <div className="hidden sm:block w-14">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Bins</span>
            </div>
            <div className="hidden lg:block w-14">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Areas</span>
            </div>
            <div className="hidden sm:block w-24">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Created</span>
            </div>
          </TableHeader>
          {locations.map((loc) => (
            <TableRow key={loc.id} className="cursor-default [@media(hover:hover)]:hover:bg-[var(--bg-hover)]">
              <div className="flex-1 min-w-0">
                <span className="text-[14px] font-medium text-[var(--text-primary)] truncate block">{loc.name}</span>
              </div>
              <div className="w-24 truncate">
                <span className="text-[14px] text-[var(--text-secondary)]">{loc.ownerDisplayName || loc.ownerUsername}</span>
              </div>
              <div className="hidden sm:block w-16 text-[14px] text-[var(--text-secondary)] tabular-nums">{loc.memberCount}</div>
              <div className="hidden sm:block w-14 text-[14px] text-[var(--text-secondary)] tabular-nums">{loc.binCount}</div>
              <div className="hidden lg:block w-14 text-[14px] text-[var(--text-secondary)] tabular-nums">{loc.areaCount}</div>
              <div className="hidden sm:block w-24">
                <span className="text-[12px] text-[var(--text-tertiary)] whitespace-nowrap">{new Date(loc.createdAt).toLocaleDateString()}</span>
              </div>
            </TableRow>
          ))}
        </Table>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={count}
        pageSize={PAGE_SIZE}
        itemLabel="locations"
      />
    </>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export function AdminSystemPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect non-admins
  useEffect(() => {
    if (user && !user.isAdmin) navigate('/', { replace: true });
  }, [user, navigate]);

  const [tab, setTab] = useState<Tab>('system');

  // Prevent flash of admin content for non-admins
  if (user && !user.isAdmin) return null;

  return (
    <div className="page-content-wide">
      <PageHeader
        title="System"
        back
        backTo="/admin/users"
        actions={
          <OptionGroup
            options={[
              { key: 'system' as const, label: 'System', icon: Server },
              { key: 'audit' as const, label: 'Audit Log', icon: ShieldAlert },
              { key: 'locations' as const, label: 'Locations', icon: MapPin },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      {tab === 'system' && <SystemTab />}
      {tab === 'audit' && <AuditLogTab />}
      {tab === 'locations' && <LocationsTab />}
    </div>
  );
}
