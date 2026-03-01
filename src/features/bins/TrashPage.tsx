import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { useToast } from '@/components/ui/toast';
import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import { formatTimeAgo } from '@/lib/formatTime';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import type { Bin } from '@/types';
import { notifyBinsChanged, permanentDeleteBin, restoreBinFromTrash, useTrashBins } from './useBins';

export function TrashPage() {
  const navigate = useNavigate();
  const { bins, isLoading } = useTrashBins();
  const { showToast } = useToast();
  const { activeLocationId } = useAuth();
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const t = useTerminology();
  const { locations } = useLocationList();
  const [confirmDelete, setConfirmDelete] = useState<Bin | null>(null);
  const activeLoc = locations.find((l) => l.id === activeLocationId);
  const retentionDays = (activeLoc as { trash_retention_days?: number } | undefined)?.trash_retention_days ?? 30;

  useEffect(() => {
    if (!permissionsLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [permissionsLoading, isAdmin, navigate]);

  if (permissionsLoading || !isAdmin) {
    return null;
  }

  async function handleRestore(bin: Bin) {
    try {
      await restoreBinFromTrash(bin.id);
      showToast({ message: `"${bin.name}" restored` });
    } catch {
      showToast({ message: `Failed to restore ${t.bin}` });
    }
  }

  async function handlePermanentDelete() {
    if (!confirmDelete) return;
    try {
      await permanentDeleteBin(confirmDelete.id);
      notifyBinsChanged();
      showToast({ message: `"${confirmDelete.name}" permanently deleted` });
    } catch {
      showToast({ message: `Failed to delete ${t.bin}` });
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="page-content">
      <PageHeader title="Trash" />
      <p className="text-[13px] text-[var(--text-tertiary)]">
        Deleted {t.bins} are kept for {retentionDays} day{retentionDays !== 1 ? 's' : ''} before being permanently removed.
      </p>

      {isLoading ? (
        <SkeletonList count={3} className="flex flex-col gap-3">
          {() => (
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3.5 w-1/3" />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Skeleton className="h-8 w-20 rounded-[var(--radius-full)]" />
                    <Skeleton className="h-8 w-8 rounded-[var(--radius-full)]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </SkeletonList>
      ) : bins.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          subtitle={`Deleted ${t.bins} will appear here`}
        />
      ) : (
        <div className="space-y-3">
          {bins.map((bin) => (
            <Card key={bin.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                      {bin.name}
                    </p>
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      Deleted {formatTimeAgo(bin.deleted_at ?? bin.updated_at)}
                      {bin.area_name ? ` · ${bin.area_name}` : ''}
                      {Array.isArray(bin.items) && bin.items.length > 0 ? ` · ${bin.items.length} ${bin.items.length === 1 ? 'item' : 'items'}` : ''}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(bin)}
                        className="h-8 px-2.5 rounded-[var(--radius-full)] text-[var(--accent)]"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(bin)}
                        className="h-8 px-2.5 rounded-[var(--radius-full)] text-[var(--destructive)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm permanent delete */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--destructive)] bg-opacity-10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-[var(--destructive)]" />
            </div>
            <div>
              <p className="text-[15px] text-[var(--text-primary)]">
                Are you sure you want to permanently delete <strong>"{confirmDelete?.name}"</strong>?
              </p>
              <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
                This action cannot be undone. All photos will also be deleted.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="rounded-[var(--radius-full)]">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              className="rounded-[var(--radius-full)]"
            >
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
