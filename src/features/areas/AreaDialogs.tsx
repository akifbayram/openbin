import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { useTerminology } from '@/lib/terminology';
import { createArea, deleteArea } from './useAreas';

/* ------------------------------------------------------------------ */
/*  Create Area Dialog                                                 */
/* ------------------------------------------------------------------ */

interface CreateAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
}

export function CreateAreaDialog({ open, onOpenChange, locationId }: CreateAreaDialogProps) {
  const t = useTerminology();
  const { showToast } = useToast();
  const [newAreaName, setNewAreaName] = useState('');
  const [creatingArea, setCreatingArea] = useState(false);

  async function handleCreateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!newAreaName.trim() || !locationId) return;
    setCreatingArea(true);
    try {
      await createArea(locationId, newAreaName.trim());
      setNewAreaName('');
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
              autoFocus
              required
            />
          </div>
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

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Delete ${t.area}?`}</DialogTitle>
          <DialogDescription>
            {target && target.binCount > 0
              ? `"${target.name}" has ${target.binCount} ${target.binCount !== 1 ? t.bins : t.bin}. They will become unassigned.`
              : `Delete "${target?.name}"?`}
          </DialogDescription>
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
