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
import { cn } from '@/lib/utils';
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
  const [defaultJoinRole, setDefaultJoinRole] = useState<'member' | 'viewer'>('member');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && location) {
      setActivityRetention(location.activity_retention_days ?? 90);
      setTrashRetention(location.trash_retention_days ?? 30);
      setDefaultJoinRole(location.default_join_role ?? 'member');
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
        default_join_role: defaultJoinRole,
      });
      onOpenChange(false);
      showToast({ message: 'Retention settings saved', variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to save retention settings', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.Location} Settings</DialogTitle>
          <DialogDescription>
            Configure data retention and membership defaults for this {t.location}.
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
          <div className="space-y-1.5">
            <Label>Default role for new members</Label>
            <div className="flex gap-2">
              {(['member', 'viewer'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDefaultJoinRole(r)}
                  className={cn(
                    'flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-[13px] font-medium transition-colors',
                    defaultJoinRole === r
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                  )}
                >
                  {r === 'member' ? 'Member' : 'Viewer'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {defaultJoinRole === 'viewer'
                ? 'New members will be read-only until promoted.'
                : 'New members can create and edit content.'}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || activityRetention < 7 || activityRetention > 365 || trashRetention < 7 || trashRetention > 365}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
