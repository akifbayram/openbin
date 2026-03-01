import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/components/ui/toast';
import { useTerminology } from '@/lib/terminology';
import type { Location } from '@/types';
import { updateLocation } from './useLocations';

interface LocationRetentionDialogProps {
  location: Location | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationRetentionDialog({ location, open, onOpenChange }: LocationRetentionDialogProps) {
  const { showToast } = useToast();
  const t = useTerminology();
  const [activityRetention, setActivityRetention] = useState(90);
  const [trashRetention, setTrashRetention] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && location) {
      setActivityRetention(location.activity_retention_days ?? 90);
      setTrashRetention(location.trash_retention_days ?? 30);
      setSaving(false);
    }
  }, [open, location]);

  async function handleSave() {
    if (!location) return;
    setSaving(true);
    try {
      await updateLocation(location.id, {
        activity_retention_days: activityRetention,
        trash_retention_days: trashRetention,
      });
      onOpenChange(false);
      showToast({ message: 'Retention settings saved' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to save retention settings' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Data Retention</DialogTitle>
          <DialogDescription>
            Configure how long data is kept for this {t.location}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="activity-retention">Activity log retention (days)</Label>
            <Input
              id="activity-retention"
              type="number"
              min={7}
              max={365}
              value={activityRetention}
              onChange={(e) => setActivityRetention(Number(e.target.value))}
            />
            <p className="text-[11px] text-[var(--text-tertiary)]">7–365 days. Entries older than this are automatically pruned.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trash-retention">Trash retention (days)</Label>
            <Input
              id="trash-retention"
              type="number"
              min={7}
              max={365}
              value={trashRetention}
              onChange={(e) => setTrashRetention(Number(e.target.value))}
            />
            <p className="text-[11px] text-[var(--text-tertiary)]">7–365 days. Deleted {t.bins} are permanently purged after this period.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-[var(--radius-full)]">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || activityRetention < 7 || activityRetention > 365 || trashRetention < 7 || trashRetention > 365}
            className="rounded-[var(--radius-full)]"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
