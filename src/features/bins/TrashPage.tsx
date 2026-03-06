import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { toaster } from '@/components/ui/toaster';
import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import { formatTimeAgo } from '@/lib/formatTime';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import type { Bin } from '@/types';
import { notifyBinsChanged, permanentDeleteBin, restoreBinFromTrash, useTrashBins } from './useBins';
import { DRAWER_PLACEMENT } from '@/components/ui/provider'
import { Button, Drawer } from '@chakra-ui/react'


export function TrashPage() {
  const navigate = useNavigate();
  const { bins, isLoading } = useTrashBins();
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
      toaster.create({ description: `"${bin.name}" restored` });
    } catch {
      toaster.create({ description: `Failed to restore ${t.bin}` });
    }
  }

  async function handlePermanentDelete() {
    if (!confirmDelete) return;
    try {
      await permanentDeleteBin(confirmDelete.id);
      notifyBinsChanged();
      toaster.create({ description: `"${confirmDelete.name}" permanently deleted` });
    } catch {
      toaster.create({ description: `Failed to delete ${t.bin}` });
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="page-content">
      <PageHeader title="Trash" />
      <p className="text-[13px] text-gray-500 dark:text-gray-400">
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
                    <p className="text-[15px] font-semibold truncate">
                      {bin.name}
                    </p>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">
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
                        height="8" className="px-2.5 text-purple-600 dark:text-purple-500"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(bin)}
                        height="8" className="px-2.5 text-red-500 dark:text-red-400"
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
      <Drawer.Root role="alertdialog" placement={DRAWER_PLACEMENT} open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Title>Permanently Delete</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-[15px]">
                    Are you sure you want to permanently delete <strong>"{confirmDelete?.name}"</strong>?
                  </p>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
                    This action cannot be undone. All photos will also be deleted.
                  </p>
                </div>
              </div>
            </Drawer.Body>
            <Drawer.Footer>
              <Button width="full" variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                width="full"
                variant="solid" colorPalette="red"
                onClick={handlePermanentDelete}
              >
                Delete Forever
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </div>
  );
}
