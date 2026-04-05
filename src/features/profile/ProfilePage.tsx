import { Calendar, Eye, EyeOff, Loader2, MapPin, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
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

function validateDisplayName(value: string): string | undefined {
  if (!value.trim()) return 'Display name is required';
  return undefined;
}

export function ProfilePage() {
  const { user, updateUser } = useAuth();
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

  // Dirty state tracking + beforeunload guard
  const profileDirty = user
    ? displayName !== (user.displayName || '') || email !== (user.email || '')
    : false;
  useWarnOnUnload(profileDirty);

  // Password strength
  const passwordChecks = useMemo(() => computePasswordChecks(newPassword), [newPassword]);

  if (!user) return null;

  const avatarSrc = user.avatarUrl ? `${getAvatarUrl(user.avatarUrl)}?v=${avatarKey}` : null;

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

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : 'Unknown';

  return (
    <div className="page-content">
      <PageHeader title="Profile" />

      {/* Identity hero */}
      <div className="flex flex-col items-center py-6">
        <div className="relative group">
          {avatarSrc && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={uploadingAvatar}
              className="absolute -top-1.5 -right-1.5 z-10 h-7 w-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-flat)] flex items-center justify-center hover:bg-[var(--destructive)] hover:text-white transition-colors duration-150 disabled:opacity-50 opacity-0 group-hover:opacity-100 max-lg:opacity-100"
              aria-label="Remove avatar"
            >
              <X className="h-3.5 w-3.5" />
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
              size="xl"
            />
            <div
              className={cn(
                'absolute inset-0 rounded-full bg-black/30 flex items-center justify-center transition-opacity duration-200',
                uploadingAvatar ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
            >
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          </button>
        </div>

        <h2 className="text-[22px] font-bold text-[var(--text-primary)] mt-4 leading-tight">
          {user.displayName || user.username}
        </h2>
        <p className="text-[15px] text-[var(--text-tertiary)]">@{user.username}</p>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3 text-[14px] text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {memberSince}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {locations.length} location{locations.length !== 1 ? 's' : ''}
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleAvatarSelected(e.target.files)}
        />
      </div>

      {/* Profile info */}
      <Card>
        <CardContent>
          <Disclosure
            label={<span className="text-[var(--text-primary)]">Profile Info</span>}
            labelClassName="text-[15px] font-semibold"
            defaultOpen
          >
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 mt-1">
              <FormField
                label="Display Name"
                htmlFor="profile-name"
                error={profileErrors.displayName}
              >
                <Input
                  id="profile-name"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (profileErrors.displayName) setProfileErrors(prev => ({ ...prev, displayName: undefined }));
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
                  onChange={(e) => { setEmail(e.target.value); if (profileErrors.email) setProfileErrors(prev => ({ ...prev, email: undefined })); }}
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
                className="mt-1"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </form>
          </Disclosure>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardContent>
          <Disclosure
            label={<span className="text-[var(--text-primary)]">Change Password</span>}
            labelClassName="text-[15px] font-semibold"
          >
            <form onSubmit={handleChangePassword} className="flex flex-col gap-3 mt-1">
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
                <p role="alert" className="text-[13px] text-[var(--destructive)]">
                  {passwordError}
                </p>
              )}

              <Button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="mt-1"
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </Disclosure>
        </CardContent>
      </Card>
    </div>
  );
}
