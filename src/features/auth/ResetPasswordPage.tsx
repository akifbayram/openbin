import { KeyRound, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api';
import { useAppSettings } from '@/lib/appSettings';
import { cycleThemePreference, useTheme } from '@/lib/theme';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { showToast } = useToast();
  const { settings } = useAppSettings();
  const { preference, setThemePreference } = useTheme();
  const ThemeIcon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast({ message: 'Passwords do not match', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword },
      });
      setSuccess(true);
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Failed to reset password',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg-base)] relative">
      <button
        type="button"
        onClick={() => setThemePreference(cycleThemePreference(preference))}
        aria-label={`Theme: ${preference}`}
        className="absolute top-4 right-4 p-2.5 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <ThemeIcon className="h-5 w-5" />
      </button>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">
            {settings.appName}
          </h1>
        </div>

        {!token ? (
          <Card>
            <CardContent className="py-6 text-center space-y-4">
              <p className="text-[15px] text-[var(--text-secondary)]">
                Invalid reset link. Please ask your admin for a new one.
              </p>
              <Link to="/login" className="text-[var(--accent)] font-medium hover:underline text-[14px]">
                Back to login
              </Link>
            </CardContent>
          </Card>
        ) : success ? (
          <Card>
            <CardContent className="py-6 text-center space-y-4">
              <p className="text-[15px] text-[var(--text-primary)] font-medium">
                Password reset successfully!
              </p>
              <Link to="/login">
                <Button className="w-full rounded-[var(--radius-md)] h-11 text-[15px]">
                  Sign In
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-[14px] text-[var(--text-secondary)]">
                  Enter your new password below.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!newPassword || !confirmPassword || loading}
                  className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
