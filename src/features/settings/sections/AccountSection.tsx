import { Calendar, Check, Copy, Eye, EyeOff, Key, Link2, Link2Off, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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
import { Tooltip } from '@/components/ui/tooltip';
import { useLocationList } from '@/features/locations/useLocations';
import { compressImage } from '@/features/photos/compressImage';
import { apiFetch, getAvatarUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { allChecksPassing, computePasswordChecks } from '@/lib/passwordStrength';
import { useAuthStatusConfig } from '@/lib/qrConfig';
import { usePlan } from '@/lib/usePlan';
import { useWarnOnUnload } from '@/lib/useWarnOnUnload';
import { EMAIL_REGEX, getErrorMessage } from '@/lib/utils';
import type { User } from '@/types';
import { SettingsListRow } from '../SettingsListRow';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsProfileHeader } from '../SettingsProfileHeader';
import { SettingsSection } from '../SettingsSection';
import { createApiKey, revokeApiKey, useApiKeys } from '../useApiKeys';

const UpgradePrompt = __EE__
  ? lazy(() => import('@/ee/UpgradePrompt').then(m => ({ default: m.UpgradePrompt })))
  : (() => null) as React.FC<Record<string, unknown>>;

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function validateDisplayName(value: string): string | undefined {
  if (!value.trim()) return 'Display name is required';
  return undefined;
}

export function AccountSection() {
  const { user, updateUser, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const { locations } = useLocationList();

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

  // Connected accounts (OAuth)
  const [oauthLinks, setOauthLinks] = useState<{ provider: string; email: string | null; created_at: string }[]>([]);
  const { config: authStatus } = useAuthStatusConfig();
  const oauthProviders = authStatus.oauthProviders;
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const hasPassword = user?.hasPassword !== false;

  // API keys
  const { isGated, isSelfHosted, planInfo } = usePlan();
  const apiKeysGated = !isSelfHosted && isGated('apiKeys');
  const { keys, isLoading: keysLoading } = useApiKeys();
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Dirty state + beforeunload guard
  const profileDirty = user
    ? displayName !== (user.displayName || '') || email !== (user.email || '')
    : false;
  useWarnOnUnload(profileDirty);

  useEffect(() => {
    const abort = new AbortController();
    apiFetch<{ results: { provider: string; email: string | null; created_at: string }[] }>(
      '/api/auth/oauth/links',
      { signal: abort.signal },
    )
      .then((data) => setOauthLinks(data.results))
      .catch((err) => {
        if (abort.signal.aborted) return;
        showToast({ message: getErrorMessage(err, 'Failed to load connected accounts'), variant: 'error' });
      });
    return () => { abort.abort(); };
  }, [showToast]);

  const passwordChecks = useMemo(() => computePasswordChecks(newPassword), [newPassword]);

  // Reset form state when dialog opens (not on close, to avoid flash during exit animation)
  useEffect(() => {
    if (createOpen) {
      setNewKey(null);
      setKeyName('');
      setCopied(false);
    }
  }, [createOpen]);

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

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('avatar', compressed, file.name);
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
    if (hasPassword && !deletePassword) return;
    setDeleting(true);
    try {
      await deleteAccount(hasPassword ? deletePassword : undefined);
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to delete account'), variant: 'error' });
      setDeleting(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await createApiKey(keyName.trim());
      setNewKey(result.key);
      setKeyName('');
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to create API key'), variant: 'error' });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeId) return;
    setRevoking(true);
    try {
      await revokeApiKey(revokeId);
      showToast({ message: 'API key revoked', variant: 'success' });
      setRevokeId(null);
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to revoke API key'), variant: 'error' });
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ message: 'Failed to copy', variant: 'error' });
    }
  }

  return (
    <>
      <SettingsPageHeader
        title="Account"
        description="Manage your profile, password, and access keys."
      />

      <SettingsSection label="Profile">
        <SettingsProfileHeader
          avatarUrl={avatarSrc}
          displayName={user.displayName || user.email}
          email={user.email}
          uploading={uploadingAvatar}
          onAvatarUpload={handleAvatarUpload}
          onAvatarRemove={handleRemoveAvatar}
          meta={
            <>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {memberSince}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locations.length} location{locations.length !== 1 ? 's' : ''}
              </span>
            </>
          }
        />

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 pt-5">
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
              maxLength={100}
              required
              aria-invalid={!!profileErrors.displayName}
            />
          </FormField>
          <FormField
            label="Email"
            htmlFor="profile-email"
            hint="Optional — used for account recovery"
            error={profileErrors.email}
          >
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (profileErrors.email) setProfileErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!profileErrors.email}
            />
          </FormField>
          <Button
            type="submit"
            disabled={savingProfile || !displayName.trim() || !profileDirty}
            className="self-start mt-1"
          >
            {savingProfile ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Profile'}
          </Button>
        </form>
      </SettingsSection>

      {hasPassword && (
        <SettingsSection label="Password" dividerAbove>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
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
              <p role="alert" className="settings-row-desc text-[var(--destructive)]">{passwordError}</p>
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
      )}

      {oauthProviders.length > 0 && (
        <SettingsSection label="Connected Accounts" dividerAbove>
          {oauthProviders.map((provider) => {
            const link = oauthLinks.find((l) => l.provider === provider);
            const providerLabel = provider === 'google' ? 'Google' : 'Apple';
            const canUnlink = oauthLinks.length > 1 || hasPassword;
            const hintId = `${provider}-unlink-hint`;

            return (
              <SettingsListRow
                key={provider}
                icon={Link2}
                title={providerLabel}
                meta={
                  <>
                    {link ? (link.email || 'Connected') : 'Not connected'}
                    {link && !canUnlink && (
                      <span id={hintId} className="block mt-0.5">Set a password to disconnect</span>
                    )}
                  </>
                }
                action={
                  link ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canUnlink || unlinking === provider}
                      aria-describedby={!canUnlink ? hintId : undefined}
                      onClick={async () => {
                        setUnlinking(provider);
                        try {
                          await apiFetch(`/api/auth/oauth/link/${provider}`, { method: 'DELETE' });
                          setOauthLinks((prev) => prev.filter((l) => l.provider !== provider));
                          showToast({ message: `${providerLabel} disconnected`, variant: 'success' });
                        } catch (err) {
                          showToast({ message: getErrorMessage(err, `Failed to disconnect ${providerLabel}`), variant: 'error' });
                        } finally {
                          setUnlinking(null);
                        }
                      }}
                    >
                      {unlinking === provider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4 mr-1.5" />}
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { window.location.href = `/api/auth/oauth/${provider}`; }}
                    >
                      <Link2 className="h-4 w-4 mr-1.5" />
                      Connect
                    </Button>
                  )
                }
              />
            );
          })}
        </SettingsSection>
      )}

      {apiKeysGated ? (
        __EE__ && (
          <Suspense fallback={null}>
            <UpgradePrompt
              feature="API Keys"
              description="Create API keys to integrate with external tools."
              upgradeUrl={planInfo.upgradeUrl}
            />
          </Suspense>
        )
      ) : (
        <SettingsSection
          label="API Keys"
          dividerAbove
          description="API keys are tied to your account and work across all your locations. Use them for smart home integrations and automation."
          action={
            <Tooltip content="Create API key" side="bottom">
              <Button
                onClick={() => setCreateOpen(true)}
                size="icon"
                aria-label="Create API key"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </Tooltip>
          }
        >
          {keysLoading ? null : keys.length === 0 ? (
            <p className="settings-row-desc py-4 text-center">
              No API keys yet. Create one to connect integrations.
            </p>
          ) : (
            keys.map((k) => (
              <SettingsListRow
                key={k.id}
                icon={Key}
                title={k.name || k.key_prefix}
                meta={
                  <>
                    {k.key_prefix}... &middot; Created {formatDate(k.created_at)}
                    {k.last_used_at ? ` \u00b7 Last used ${formatDate(k.last_used_at)}` : ''}
                  </>
                }
                action={
                  <Tooltip content="Revoke API key" side="bottom">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[var(--destructive)] shrink-0"
                      onClick={() => setRevokeId(k.id)}
                      aria-label="Revoke API key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                }
              />
            ))
          )}
        </SettingsSection>
      )}

      <SettingsSection
        label="Danger Zone"
        dividerAbove
        status="danger"
        tintLabel
        statusMessage="Deleting your account removes all locations where you are the only member. Shared locations are preserved. This action cannot be undone."
      >
        <div className="pt-1">
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
            {hasPassword ? (
              <div className="space-y-2">
                <Label htmlFor="delete-password">Enter your password to confirm</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Password"
                  required
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                Are you sure you want to continue?
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setDeleteOpen(false); setDeletePassword(''); }}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={(hasPassword && !deletePassword) || deleting}>
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
            <DialogDescription>
              {newKey
                ? 'Copy this key now — it won\'t be shown again.'
                : 'Give your key a name to help you identify it later.'}
            </DialogDescription>
          </DialogHeader>
          {newKey ? (
            <div className="space-y-4">
              <div className="row">
                <code className="flex-1 text-[var(--text-sm)] bg-[var(--bg-input)] px-3 py-2 rounded-[var(--radius-sm)] break-all select-all font-mono">
                  {newKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCopy}
                  aria-label={copied ? 'Copied' : 'Copy API key'}
                >
                  {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setCreateOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateKey} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Home Assistant, Alexa"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key?</DialogTitle>
            <DialogDescription>
              Any integrations using this key will stop working immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
