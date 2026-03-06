import { ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog, Input } from '@chakra-ui/react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
          <Label className="inline-flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" />Danger Zone</Label>
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

      <Dialog.Root open={deleteOpen} onOpenChange={(e) => { setDeleteOpen(e.open); if (!e.open) { setDeletePassword(''); setDeleting(false); } }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger />
            <Dialog.Header>
              <Dialog.Title>Delete Account</Dialog.Title>
              <Dialog.Description>
                This will permanently delete your account and all data in locations where you are the only member. Locations shared with others will be preserved. This action cannot be undone.
              </Dialog.Description>
            </Dialog.Header>
            <Dialog.Body>
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
              </form>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setDeleteOpen(false); setDeletePassword(''); }}
                className="rounded-[var(--radius-full)]"
              >
                Cancel
              </Button>
              <Button
                onClick={(e: React.MouseEvent) => handleDeleteAccount(e as unknown as React.FormEvent)}
                disabled={!deletePassword || deleting}
                className="rounded-[var(--radius-full)] bg-[var(--destructive)] hover:opacity-90"
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}
