import { ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Drawer, Input } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toaster } from '@/components/ui/toaster';

interface DangerZoneSectionProps {
  deleteAccount: (password: string) => Promise<void>;
}

export function DangerZoneSection({ deleteAccount }: DangerZoneSectionProps) {
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
      toaster.create({ description: err instanceof Error ? err.message : 'Failed to delete account' });
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
              className="text-red-500 dark:text-red-400 border-red-500/30"
              justifyContent="start" borderRadius="var(--radius-sm)" height="11"
            >
              <Trash2 className="h-4 w-4 mr-2.5" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Drawer.Root role="alertdialog" placement={DRAWER_PLACEMENT} open={deleteOpen} onOpenChange={(e) => { setDeleteOpen(e.open); if (!e.open) { setDeletePassword(''); setDeleting(false); } }}>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Title>Delete Account</Drawer.Title>
              <Drawer.Description>
                This will permanently delete your account and all data in locations where you are the only member. Locations shared with others will be preserved. This action cannot be undone.
              </Drawer.Description>
            </Drawer.Header>
            <Drawer.Body>
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
            </Drawer.Body>
            <Drawer.Footer>
              <Button
                width="full"
                type="button"
                variant="ghost"
                onClick={() => { setDeleteOpen(false); setDeletePassword(''); }}
              >
                Cancel
              </Button>
              <Button
                width="full"
                onClick={(e: React.MouseEvent) => handleDeleteAccount(e as unknown as React.FormEvent)}
                disabled={!deletePassword || deleting}
                className="bg-red-500 hover:opacity-90"
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}
