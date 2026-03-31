import { AlertTriangle, Check, Monitor, Moon, Sun, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandIcon } from '@/components/BrandIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { cycleThemePreference, useTheme } from '@/lib/theme';
import { getErrorMessage } from '@/lib/utils';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const { showToast } = useToast();
  const { settings } = useAppSettings();
  const { preference, setThemePreference } = useTheme();
  const ThemeIcon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(searchParams.get('invite') ?? '');
  const [registrationMode, setRegistrationMode] = useState<'open' | 'invite'>('open');
  const [loading, setLoading] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{ name: string; memberCount: number } | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = useCallback((field: string) => setTouched((t) => ({ ...t, [field]: true })), []);

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.registrationMode === 'closed' || data.registrationEnabled === false) {
          showToast({ message: 'Registration is currently disabled', variant: 'warning' });
          navigate('/login');
        }
        setRegistrationMode(data.registrationMode ?? 'open');
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, showToast]);

  useEffect(() => {
    if (!inviteCode) return;
    fetch(`/api/auth/invite-preview?code=${encodeURIComponent(inviteCode)}`)
      .then((r) => {
        if (r.ok) return r.json();
        if (r.status === 404) {
          setInviteInvalid(true);
          return null;
        }
        return null;
      })
      .then((data) => {
        if (data) setInvitePreview(data);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
  }), [password]);

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string | undefined> = {};
    if (username && !USERNAME_REGEX.test(username)) {
      errors.username = 'Must be 3-50 characters (letters, numbers, underscores)';
    }
    if (confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (registrationMode === 'invite' && touched.inviteCode && !inviteCode.trim()) {
      errors.inviteCode = 'An invite code is required to register';
    }
    return errors;
  }, [username, password, confirmPassword, inviteCode, registrationMode, touched.inviteCode]);

  function validate(): string | null {
    if (!USERNAME_REGEX.test(username)) {
      return 'Username must be 3-50 characters (letters, numbers, underscores)';
    }
    if (!passwordChecks.length || !passwordChecks.uppercase || !passwordChecks.lowercase || !passwordChecks.digit) {
      return 'Password must be 8+ characters with uppercase, lowercase, and a number';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    if (registrationMode === 'invite' && !inviteCode.trim()) {
      return 'An invite code is required to register';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      setTouched({ username: true, confirmPassword: true, inviteCode: true });
      showToast({ message: error, variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), password, displayName.trim() || username.trim(), email.trim() || undefined, inviteCode.trim() || undefined);
      navigate('/');
    } catch (err) {
      showToast({
        message: getErrorMessage(err, 'Registration failed'),
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-pattern min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg-base)]">
      <button
        type="button"
        onClick={() => setThemePreference(cycleThemePreference(preference))}
        aria-label={`Switch theme, currently ${preference}`}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <ThemeIcon className="h-5 w-5" />
      </button>
      <div className="relative z-[1] w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <BrandIcon className="h-12 w-12 mx-auto text-[var(--accent)] mb-3" />
          <h1 className="font-heading text-[28px] font-bold text-[var(--text-primary)] tracking-tight">
            {settings.appName}
          </h1>
          <p className="text-[14px] text-[var(--text-tertiary)]">Create your account</p>
        </div>

        {invitePreview && (
          <div className="flat-card flex items-center gap-3 px-4 py-3 text-[14px]">
            <Users className="h-5 w-5 text-[var(--accent)] shrink-0" />
            <span>
              You've been invited to join <strong>{invitePreview.name}</strong>
              <span className="text-[var(--text-tertiary)]"> · {invitePreview.memberCount} {invitePreview.memberCount === 1 ? 'member' : 'members'}</span>
            </span>
          </div>
        )}
        {inviteInvalid && (
          <div className="flat-card flex items-center gap-3 px-4 py-3 text-[14px] bg-[var(--color-warning-soft)]">
            <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] shrink-0" />
            <span>This invite code is invalid or expired</span>
          </div>
        )}

        <Card>
          <CardContent className="py-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reg-username">Username</Label>
                <Input
                  id="reg-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={() => markTouched('username')}
                  placeholder="Letters, numbers, underscores"
                  autoComplete="username"
                  autoFocus
                  required
                  aria-invalid={touched.username && !!fieldErrors.username}
                  aria-describedby={touched.username && fieldErrors.username ? 'reg-username-error' : undefined}
                />
                {touched.username && fieldErrors.username && (
                  <p id="reg-username-error" role="alert" className="text-[11px] text-[var(--destructive)]">{fieldErrors.username}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-display-name">Display Name</Label>
                <Input
                  id="reg-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How you appear to others"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Optional"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, mixed case & number"
                  autoComplete="new-password"
                  required
                />
                {password.length > 0 && (
                  <ul aria-label="Password requirements" className="space-y-1 pt-1.5 text-[13px]">
                    {([
                      ['length', 'At least 8 characters'],
                      ['uppercase', 'Contains an uppercase letter'],
                      ['lowercase', 'Contains a lowercase letter'],
                      ['digit', 'Contains a number'],
                    ] as const).map(([key, label]) => (
                      <li key={key} className="row-tight" aria-label={`${label} — ${passwordChecks[key] ? 'met' : 'not met'}`}>
                        {passwordChecks[key] ? (
                          <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" aria-hidden="true" />
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border-default)]" aria-hidden="true" />
                        )}
                        <span className={passwordChecks[key] ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}>
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-confirm">Confirm Password</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => markTouched('confirmPassword')}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                  aria-invalid={touched.confirmPassword && !!fieldErrors.confirmPassword}
                  aria-describedby={touched.confirmPassword && fieldErrors.confirmPassword ? 'reg-confirm-error' : undefined}
                />
                {touched.confirmPassword && fieldErrors.confirmPassword && (
                  <p id="reg-confirm-error" role="alert" className="text-[11px] text-[var(--destructive)]">{fieldErrors.confirmPassword}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-invite">
                  {registrationMode === 'invite' ? 'Invite Code (required)' : 'Invite Code'}
                </Label>
                <Input
                  id="reg-invite"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onBlur={() => markTouched('inviteCode')}
                  placeholder="Paste invite code to auto-join a location"
                  aria-invalid={touched.inviteCode && !!fieldErrors.inviteCode}
                  aria-describedby={touched.inviteCode && fieldErrors.inviteCode ? 'reg-invite-error' : undefined}
                />
                {touched.inviteCode && fieldErrors.inviteCode && (
                  <p id="reg-invite-error" role="alert" className="text-[11px] text-[var(--destructive)]">{fieldErrors.inviteCode}</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={!username.trim() || !password || !confirmPassword || loading}
                className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[14px] text-[var(--text-secondary)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--accent)] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
