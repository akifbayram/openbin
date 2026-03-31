import { ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { getErrorMessage } from '@/lib/utils';

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
      showToast({ message: getErrorMessage(err, 'Failed to delete account'), variant: 'error' });
      setDeleting(false);
    }
  }

  return (
    <>
      <Card className="border-l-2 border-l-[var(--destructive)]">
        <CardContent>
          <Disclosure label={<span className="inline-flex items-center gap-1.5 text-[var(--destructive)]"><ShieldAlert className="h-4 w-4" />Danger Zone</span>} labelClassName="text-[15px] font-semibold">
          <div className="flex flex-col gap-2 mt-1">
            <p className="text-[13px] text-[var(--text-tertiary)]">
              Permanent actions that cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              className="justify-start"
            >
              <Trash2 className="h-4 w-4 mr-2.5" />
              Delete Account
            </Button>
          </div>
          </Disclosure>
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
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!deletePassword || deleting}
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
