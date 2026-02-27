import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

interface DangerZoneSectionProps {
  deleteAccount: (password: string) => Promise<void>;
}

export function DangerZoneSection({ deleteAccount }: DangerZoneSectionProps) {
  const { showToast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete account' });
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent>
          <Label>Danger Zone</Label>
          <div className="flex flex-col gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className="justify-start rounded-[var(--radius-sm)] h-11 text-[var(--destructive)] border-[var(--destructive)]/30"
            >
              <Trash2 className="h-4 w-4 mr-2.5" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) { setDeletePassword(''); setDeleting(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all data in locations where you are the only member. Locations shared with others will be preserved. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteAccount} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="delete-password">Enter your password to confirm</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Password"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setDeleteOpen(false); setDeletePassword(''); }}
                className="rounded-[var(--radius-full)]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!deletePassword || deleting}
                className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:opacity-90"
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
