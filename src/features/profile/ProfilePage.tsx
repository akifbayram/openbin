import { Calendar, ChevronDown, MapPin, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useLocationList } from '@/features/locations/useLocations';
import { compressImage } from '@/features/photos/compressImage';
import { apiFetch, getAvatarUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/types';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const { locations } = useLocationList();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!user) return null;

  const avatarSrc = user.avatarUrl ? `${getAvatarUrl(user.avatarUrl)}?t=${Date.now()}` : null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      showToast({ message: 'Display name is required' });
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await apiFetch<User>('/api/auth/profile', {
        method: 'PUT',
        body: { displayName: trimmedName, email: email.trim() || null },
      });
      updateUser(updated);
      showToast({ message: 'Profile updated' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast({ message: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ message: 'Passwords do not match' });
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
      showToast({ message: 'Password updated' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to change password' });
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
      showToast({ message: 'Avatar updated' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to upload avatar' });
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
      showToast({ message: 'Avatar removed' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to remove avatar' });
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
      <div className="flex flex-col items-center py-2">
        <div className="relative group">
          {avatarSrc && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={uploadingAvatar}
              className="absolute -top-1 -right-1 z-10 h-5 w-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center shadow-sm hover:bg-[var(--destructive)] hover:text-white transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100 max-lg:opacity-100"
              aria-label="Remove avatar"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 rounded-full"
            aria-label="Change avatar"
          >
            <UserAvatar
              avatarUrl={avatarSrc}
              displayName={user.displayName || user.username}
              size="lg"
              className="h-28 w-28 text-[36px]"
            />
          </button>
        </div>

        <h2 className="text-[22px] font-bold text-[var(--text-primary)] mt-3 leading-tight">
          {user.displayName || user.username}
        </h2>
        <p className="text-[15px] text-[var(--text-tertiary)]">@{user.username}</p>

        <div className="flex items-center gap-3 mt-3 text-[13px] text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {memberSince}
          </span>
          <span className="h-0.5 w-0.5 rounded-full bg-current opacity-40" />
          <span className="flex items-center gap-1.5">
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
          <Label>Profile Info</Label>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 mt-3">
            <FormField label="Display Name" htmlFor="profile-name">
              <Input
                id="profile-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="profile-email">
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
              />
            </FormField>
            <Button
              type="submit"
              disabled={savingProfile || !displayName.trim()}
              className="rounded-[var(--radius-sm)] h-11 mt-1"
            >
              {savingProfile ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardContent>
          <button
            type="button"
            onClick={() => setPasswordOpen((v) => !v)}
            className="flex items-center justify-between w-full"
          >
            <Label className="pointer-events-none">Change Password</Label>
            <ChevronDown
              className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-200 ${passwordOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {passwordOpen && (
            <form onSubmit={handleChangePassword} className="flex flex-col gap-3 mt-3">
              <FormField label="Current Password" htmlFor="current-password">
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="New Password" htmlFor="new-password">
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                />
              </FormField>
              <FormField label="Confirm Password" htmlFor="confirm-password">
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </FormField>
              <Button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="rounded-[var(--radius-sm)] h-11 mt-1"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
