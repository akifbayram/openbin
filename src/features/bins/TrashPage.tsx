import { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useLocationList } from '@/features/locations/useLocations';
import { useTrashBins, restoreBinFromTrash, permanentDeleteBin, notifyBinsChanged } from './useBins';
import type { Bin } from '@/types';

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function TrashPage() {
  const { bins, isLoading } = useTrashBins();
  const { showToast } = useToast();
  const { activeLocationId } = useAuth();
  const t = useTerminology();
  const { locations } = useLocationList();
  const [confirmDelete, setConfirmDelete] = useState<Bin | null>(null);
  const activeLoc = locations.find((l) => l.id === activeLocationId);
  const retentionDays = (activeLoc as { trash_retention_days?: number } | undefined)?.trash_retention_days ?? 30;

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
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Trash
      </h1>
      <p className="text-[13px] text-[var(--text-tertiary)]">
        Deleted {t.bins} are kept for {retentionDays} day{retentionDays !== 1 ? 's' : ''} before being permanently removed.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-[var(--radius-lg)] p-4 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : bins.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <Trash2 className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              Trash is empty
            </p>
            <p className="text-[13px]">Deleted {t.bins} will appear here</p>
          </div>
        </div>
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
                      {Array.isArray(bin.items) && bin.items.length > 0 ? ` · ${bin.items.length} items` : ''}
                    </p>
                  </div>
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
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
            >
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
