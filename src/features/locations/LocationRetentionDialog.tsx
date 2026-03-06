import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { toaster } from '@/components/ui/toaster';
import { useTerminology } from '@/lib/terminology';
import type { Location } from '@/types';
import { updateLocation } from './useLocations';
import { Button, Dialog, Input } from '@chakra-ui/react'


interface LocationRetentionDialogProps {
  location: Location | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationRetentionDialog({ location, open, onOpenChange }: LocationRetentionDialogProps) {
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
      toaster.create({ description: 'Retention settings saved' });
    } catch (err) {
      toaster.create({ description: err instanceof Error ? err.message : 'Failed to save retention settings' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger />
        <Dialog.Header>
          <Dialog.Title>Data Retention</Dialog.Title>
          <Dialog.Description>
            Configure how long data is kept for this {t.location}.
          </Dialog.Description>
        </Dialog.Header>
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
            <p className="text-[11px] text-gray-500 dark:text-gray-400">7–365 days. Entries older than this are automatically pruned.</p>
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
            <p className="text-[11px] text-gray-500 dark:text-gray-400">7–365 days. Deleted {t.bins} are permanently purged after this period.</p>
          </div>
        </div>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || activityRetention < 7 || activityRetention > 365 || trashRetention < 7 || trashRetention > 365}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
        </Dialog.Positioner>
    </Dialog.Root>
  );
}
