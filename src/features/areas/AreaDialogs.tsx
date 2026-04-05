import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { useTerminology } from '@/lib/terminology';
import { cn, inputBase } from '@/lib/utils';
import type { Area } from '@/types';
import { buildAreaTree, createArea, deleteArea, flattenAreaTree } from './useAreas';

/* ------------------------------------------------------------------ */
/*  Create Area Dialog                                                 */
/* ------------------------------------------------------------------ */

interface CreateAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  areas: Area[];
  defaultParentId?: string | null;
  /** Called with the newly created area – use to auto-select in pickers */
  onCreated?: (area: Area) => void;
}

export function CreateAreaDialog({ open, onOpenChange, locationId, areas, defaultParentId, onCreated }: CreateAreaDialogProps) {
  const t = useTerminology();
  const { showToast } = useToast();
  const [newAreaName, setNewAreaName] = useState('');
  const [parentId, setParentId] = useState<string | null>(defaultParentId ?? null);
  const [creatingArea, setCreatingArea] = useState(false);

  const flatAreas = useMemo(() => flattenAreaTree(buildAreaTree(areas)), [areas]);

  // Reset parent when dialog opens
  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) {
    setParentId(defaultParentId ?? null);
  }
  if (open !== lastOpen) setLastOpen(open);

  async function handleCreateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!newAreaName.trim() || !locationId) return;
    setCreatingArea(true);
    try {
      const area = await createArea(locationId, newAreaName.trim(), parentId);
      onCreated?.(area);
      setNewAreaName('');
      setParentId(null);
      onOpenChange(false);
    } catch (err) {
      showToast({ message: err instanceof ApiError && err.status === 409 ? `${t.Area} name already exists` : 'Something went wrong', variant: 'error' });
    } finally {
      setCreatingArea(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Create ${t.Area}`}</DialogTitle>
          <DialogDescription>
            {`${t.Areas} help organize ${t.bins} by zone (e.g. Garage, Kitchen, Closet).`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateArea} className="space-y-5">
          <div className="space-y-2">
            <Input
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              placeholder={`${t.Area} name...`}
              maxLength={255}
              autoFocus
              required
            />
          </div>
          {flatAreas.length > 0 && (
            <div className="space-y-2">
              <Label className="text-[13px]">{`Parent ${t.Area}`}</Label>
              <select
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value || null)}
                className={cn(inputBase, 'h-10 focus-visible:ring-2 focus-visible:ring-[var(--accent)]')}
              >
                <option value="">No parent (root {t.area})</option>
                {flatAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {'\u00A0\u00A0'.repeat(a.depth)}{a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newAreaName.trim() || creatingArea}>
              {creatingArea ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Area Dialog                                                 */
/* ------------------------------------------------------------------ */

interface DeleteAreaTarget {
  id: string;
  name: string;
  binCount: number;
  descendantAreaCount?: number;
  descendantBinCount?: number;
}

interface DeleteAreaDialogProps {
  target: DeleteAreaTarget | null;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
}

export function DeleteAreaDialog({ target, onOpenChange, locationId }: DeleteAreaDialogProps) {
  const t = useTerminology();
  const { showToast } = useToast();
  const [deletingArea, setDeletingArea] = useState(false);

  async function handleDeleteArea() {
    if (!target || !locationId) return;
    setDeletingArea(true);
    try {
      await deleteArea(locationId, target.id);
      onOpenChange(false);
    } catch {
      showToast({ message: 'Something went wrong', variant: 'error' });
    } finally {
      setDeletingArea(false);
    }
  }

  function getDescription(): string {
    if (!target) return '';
    const hasDescendantAreas = target.descendantAreaCount && target.descendantAreaCount > 0;
    const totalBins = target.descendantBinCount ?? target.binCount;

    if (hasDescendantAreas) {
      const parts: string[] = [];
      parts.push(`${target.descendantAreaCount} sub-${target.descendantAreaCount !== 1 ? t.areas : t.area}`);
      if (totalBins > 0) {
        parts.push(`${totalBins} ${totalBins !== 1 ? t.bins : t.bin}`);
      }
      return `This will also delete ${parts.join(' and ')}. ${t.Bins} will become unassigned.`;
    }

    if (target.binCount > 0) {
      return `"${target.name}" has ${target.binCount} ${target.binCount !== 1 ? t.bins : t.bin}. They will become unassigned.`;
    }

    return `Delete "${target.name}"?`;
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Delete ${t.area}?`}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteArea}
            disabled={deletingArea}
          >
            {deletingArea ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
