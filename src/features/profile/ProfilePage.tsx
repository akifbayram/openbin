import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useLocationList } from '@/features/locations/useLocations';
import { compressImage } from '@/features/photos/compressImage';
import type { User } from '@/types';

export function ProfilePage() {
  const navigate = useNavigate();
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

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!user) return null;

  const avatarSrc = user.avatarUrl ? `${user.avatarUrl}?t=${Date.now()}` : null;

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
      updateUser({ ...user!, avatarUrl: result.avatarUrl });
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
      updateUser({ ...user!, avatarUrl: null });
      showToast({ message: 'Avatar removed' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to remove avatar' });
    } finally {
      setUploadingAvatar(false);
    }
  }

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-2 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full h-9 w-9 shrink-0"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Profile
        </h1>
      </div>

      {/* Avatar */}
      <Card>
        <CardContent>
          <Label>Photo</Label>
          <div className="flex flex-col items-center gap-3 mt-3">
            <div className="relative">
              <div className="h-24 w-24 rounded-full overflow-hidden bg-[var(--bg-active)] flex items-center justify-center text-[32px] font-bold text-[var(--text-secondary)]">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  user.displayName?.[0]?.toUpperCase() || user.username[0].toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                aria-label="Change avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            {avatarSrc && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-[13px] text-[var(--destructive)] hover:underline disabled:opacity-50"
              >
                Remove photo
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleAvatarSelected(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile Info */}
      <Card>
        <CardContent>
          <Label>Profile Info</Label>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 mt-3">
            <div className="space-y-1.5">
              <label htmlFor="profile-name" className="text-[13px] text-[var(--text-secondary)]">Display Name</label>
              <Input
                id="profile-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-email" className="text-[13px] text-[var(--text-secondary)]">Email</label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>
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

      {/* Change Password */}
      <Card>
        <CardContent>
          <Label>Change Password</Label>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3 mt-3">
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-[13px] text-[var(--text-secondary)]">Current Password</label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-[13px] text-[var(--text-secondary)]">New Password</label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-[13px] text-[var(--text-secondary)]">Confirm Password</label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="rounded-[var(--radius-sm)] h-11 mt-1"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Metadata */}
      <Card>
        <CardContent>
          <Label>Account</Label>
          <div className="mt-3 space-y-2 text-[15px] text-[var(--text-secondary)]">
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">Username</span>
              <span className="font-medium text-[var(--text-primary)]">@{user.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">Member since</span>
              <span className="font-medium text-[var(--text-primary)]">{memberSince}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">Locations</span>
              <span className="font-medium text-[var(--text-primary)]">{locations.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
