import { Calendar, Eye, EyeOff, Loader2, MapPin, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordChecklist } from '@/components/ui/password-checklist';
import { useToast } from '@/components/ui/toast';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useLocationList } from '@/features/locations/useLocations';
import { compressImage } from '@/features/photos/compressImage';
import { apiFetch, getAvatarUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { allChecksPassing, computePasswordChecks } from '@/lib/passwordStrength';
import { useWarnOnUnload } from '@/lib/useWarnOnUnload';
import { cn, EMAIL_REGEX, getErrorMessage } from '@/lib/utils';
import type { User } from '@/types';
import { SettingsSection } from '../SettingsSection';

function validateDisplayName(value: string): string | undefined {
  if (!value.trim()) return 'Display name is required';
  return undefined;
}

export function AccountSection() {
  const { user, updateUser, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const { locations } = useLocationList();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{ displayName?: string; email?: string }>({});

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarKey, setAvatarKey] = useState(() => Date.now());

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Dirty state + beforeunload guard
  const profileDirty = user
    ? displayName !== (user.displayName || '') || email !== (user.email || '')
    : false;
  useWarnOnUnload(profileDirty);

  const passwordChecks = useMemo(() => computePasswordChecks(newPassword), [newPassword]);

  if (!user) return null;

  const avatarSrc = user.avatarUrl ? `${getAvatarUrl(user.avatarUrl)}?v=${avatarKey}` : null;

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : 'Unknown';

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const nameError = validateDisplayName(displayName);
    const trimmedEmail = email.trim();
    const emailError = trimmedEmail && !EMAIL_REGEX.test(trimmedEmail) ? 'Enter a valid email address' : undefined;
    if (nameError || emailError) {
      setProfileErrors({ displayName: nameError || undefined, email: emailError });
      return;
    }
    setProfileErrors({});
    setSavingProfile(true);
    try {
      const updated = await apiFetch<User>('/api/auth/profile', {
        method: 'PUT',
        body: { displayName: displayName.trim(), email: email.trim() || null },
      });
      updateUser(updated);
      showToast({ message: 'Profile updated', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to update profile'), variant: 'error' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    if (!allChecksPassing(passwordChecks)) {
      setPasswordError('Password does not meet all requirements');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      showToast({ message: 'Password updated', variant: 'success' });
    } catch (err) {
      setPasswordError(getErrorMessage(err, 'Failed to change password'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleAvatarSelected(files: FileList | null) {
    if (!files?.[0]) return;
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(files[0]);
      const formData = new FormData();
      formData.append('avatar', compressed, files[0].name);
      const result = await apiFetch<{ avatarUrl: string }>('/api/auth/avatar', {
        method: 'POST',
        body: formData,
      });
      if (user) updateUser({ ...user, avatarUrl: result.avatarUrl });
      setAvatarKey(Date.now());
      showToast({ message: 'Avatar updated', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to upload avatar'), variant: 'error' });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      await apiFetch('/api/auth/avatar', { method: 'DELETE' });
      if (user) updateUser({ ...user, avatarUrl: null });
      showToast({ message: 'Avatar removed', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to remove avatar'), variant: 'error' });
    } finally {
      setUploadingAvatar(false);
    }
  }

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
      <div className="mb-6">
        <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Account</h2>
        <p className="text-[13px] text-[var(--text-tertiary)]">Manage your profile and account settings.</p>
      </div>

      {/* Avatar + identity */}
      <SettingsSection label="Profile">
        <div className="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="relative group shrink-0">
            {avatarSrc && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="absolute -top-1.5 -right-1.5 z-10 h-6 w-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-flat)] flex items-center justify-center hover:bg-[var(--destructive)] hover:text-white transition-colors duration-150 disabled:opacity-50 opacity-0 group-hover:opacity-100 max-lg:opacity-100"
                aria-label="Remove avatar"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative cursor-pointer hover:opacity-80 transition-opacity duration-150 disabled:opacity-50 rounded-full"
              aria-label="Change avatar"
            >
              <UserAvatar
                avatarUrl={avatarSrc}
                displayName={user.displayName || user.username}
                size="lg"
              />
              <div
                className={cn(
                  'absolute inset-0 rounded-full bg-black/30 flex items-center justify-center transition-opacity duration-200',
                  uploadingAvatar ? 'opacity-100' : 'opacity-0 pointer-events-none',
                )}
              >
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            </button>
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{user.displayName || user.username}</p>
            <p className="text-[13px] text-[var(--text-tertiary)]">@{user.username}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[12px] text-[var(--text-tertiary)]">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {memberSince}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locations.length} location{locations.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleAvatarSelected(e.target.files)}
        />

        {/* Profile info form */}
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 py-4">
          <FormField label="Display Name" htmlFor="profile-name" error={profileErrors.displayName}>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (profileErrors.displayName) setProfileErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
              onBlur={() => {
                const err = validateDisplayName(displayName);
                if (err) setProfileErrors({ displayName: err });
              }}
              placeholder="Your name"
              maxLength={100}
              required
              aria-invalid={!!profileErrors.displayName}
            />
          </FormField>
          <FormField label="Email" htmlFor="profile-email" hint="Optional — used for account recovery" error={profileErrors.email}>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (profileErrors.email) setProfileErrors((prev) => ({ ...prev, email: undefined })); }}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!profileErrors.email}
            />
          </FormField>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Username (@{user.username}) cannot be changed.
          </p>
          <Button
            type="submit"
            disabled={savingProfile || !displayName.trim() || !profileDirty}
            className="self-start mt-1"
          >
            {savingProfile ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Profile'}
          </Button>
        </form>
      </SettingsSection>

      {/* Change password */}
      <SettingsSection label="Password">
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3 py-2">
          <FormField label="Current Password" htmlFor="current-password">
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </FormField>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <FormField label="New Password" htmlFor="new-password">
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  autoComplete="new-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-150"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>
            <FormField label="Confirm Password" htmlFor="confirm-password">
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                }}
                autoComplete="new-password"
                required
              />
            </FormField>
          </div>

          {newPassword && <PasswordChecklist checks={passwordChecks} />}

          {passwordError && (
            <p role="alert" className="text-[13px] text-[var(--destructive)]">{passwordError}</p>
          )}

          <Button
            type="submit"
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="self-start mt-1"
          >
            {savingPassword ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating...</> : 'Update Password'}
          </Button>
        </form>
      </SettingsSection>

      {/* Danger zone */}
      <SettingsSection
        label="Danger Zone"
        description="Permanent actions that cannot be undone."
        labelClassName="text-[var(--destructive)]"
      >
        <div className="py-3">
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2.5" />
            Delete Account
          </Button>
        </div>
      </SettingsSection>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) { setDeletePassword(''); setDeleting(false); }
        }}
      >
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
              <Button type="button" variant="ghost" onClick={() => { setDeleteOpen(false); setDeletePassword(''); }}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={!deletePassword || deleting}>
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
