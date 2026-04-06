import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { UserAvatar } from '@/components/ui/user-avatar';
import { getAvatarUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';
import { SettingsRow } from '../SettingsRow';
import { SettingsSection } from '../SettingsSection';

export function AccountSection() {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
    } catch (err) {
      showToast({
        message: getErrorMessage(err, 'Failed to delete account'),
        variant: 'error',
      });
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-[20px] font-bold text-[var(--text-primary)]">
          Account
        </h2>
        <p className="text-[13px] text-[var(--text-tertiary)]">
          Manage your profile and account settings.
        </p>
      </div>

      <SettingsSection label="Profile">
        <SettingsRow
          label={user.displayName || user.username}
          description={`@${user.username}`}
          icon={() => (
            <UserAvatar
              avatarUrl={
                user.avatarUrl ? getAvatarUrl(user.avatarUrl) : null
              }
              displayName={user.displayName || user.username}
              size="md"
            />
          )}
          onClick={() => navigate('/profile')}
        />
      </SettingsSection>

      <SettingsSection
        label="Danger Zone"
        description="Permanent actions that cannot be undone."
        labelClassName="text-[var(--destructive)]"
      >
        <SettingsRow
          label="Delete Account"
          description="Permanently delete your account and all associated data."
          icon={Trash2}
          destructive
          control={
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          }
        />
      </SettingsSection>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletePassword('');
            setDeleting(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all data in
              locations where you are the only member. Locations shared with
              others will be preserved. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteAccount} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="delete-password">
                Enter your password to confirm
              </Label>
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
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletePassword('');
                }}
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
