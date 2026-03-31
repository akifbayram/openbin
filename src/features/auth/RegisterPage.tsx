import { AlertTriangle, Check, Monitor, Moon, Sun, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandIcon } from '@/components/BrandIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordChecklist } from '@/components/ui/password-checklist';
import { PasswordInput } from '@/components/ui/password-input';
import { useToast } from '@/components/ui/toast';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { allChecksPassing, computePasswordChecks } from '@/lib/passwordStrength';
import { cycleThemePreference, useTheme } from '@/lib/theme';
import { cn, focusRing, getErrorMessage } from '@/lib/utils';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [selfHosted, setSelfHosted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{ name: string; memberCount: number } | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = useCallback((field: string) => setTouched((t) => ({ ...t, [field]: true })), []);

  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const inviteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.registrationMode === 'closed' || data.registrationEnabled === false) {
          showToast({ message: 'Registration is currently disabled', variant: 'warning' });
          navigate('/login');
        }
        setRegistrationMode(data.registrationMode ?? 'open');
        if (data.selfHosted === false) setSelfHosted(false);
      })
      .catch(() => {})
      .finally(() => setStatusLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, showToast]);

  // Debounced invite code preview with abort on change
  useEffect(() => {
    if (!inviteCode.trim()) {
      setInvitePreview(null);
      setInviteInvalid(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/auth/invite-preview?code=${encodeURIComponent(inviteCode.trim())}`, {
        signal: controller.signal,
      })
        .then((r) => {
          if (r.ok) return r.json();
          setInviteInvalid(r.status === 404);
          setInvitePreview(null);
          return null;
        })
        .then((data) => {
          if (data) {
            setInvitePreview(data);
            setInviteInvalid(false);
          }
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inviteCode]);

  const passwordChecks = useMemo(() => computePasswordChecks(password), [password]);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string | undefined> = {};
    if (username && !USERNAME_REGEX.test(username)) {
      errors.username = 'Must be 3\u201350 characters (letters, numbers, underscores)';
    }
    if (!selfHosted && touched.email && !email.trim()) {
      errors.email = 'Email is required';
    } else if (email && !EMAIL_REGEX.test(email)) {
      errors.email = 'Enter a valid email address';
    }
    if (confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (registrationMode === 'invite' && touched.inviteCode && !inviteCode.trim()) {
      errors.inviteCode = 'An invite code is required to register';
    }
    return errors;
  }, [username, email, password, confirmPassword, inviteCode, registrationMode, selfHosted, touched.email, touched.inviteCode]);

  function validate(): string | null {
    if (!USERNAME_REGEX.test(username)) {
      usernameRef.current?.focus();
      return 'Username must be 3\u201350 characters (letters, numbers, underscores)';
    }
    if (!selfHosted && !email.trim()) {
      emailRef.current?.focus();
      return 'Email is required';
    }
    if (email && !EMAIL_REGEX.test(email)) {
      emailRef.current?.focus();
      return 'Please enter a valid email address';
    }
    if (!allChecksPassing(passwordChecks)) {
      passwordRef.current?.focus();
      return 'Password must meet all requirements';
    }
    if (password !== confirmPassword) {
      confirmRef.current?.focus();
      return 'Passwords do not match';
    }
    if (registrationMode === 'invite' && !inviteCode.trim()) {
      inviteRef.current?.focus();
      return 'An invite code is required to register';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      setTouched({ username: true, email: true, confirmPassword: true, inviteCode: true });
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

  const optionalHint = <span className="font-normal normal-case tracking-normal text-[var(--text-tertiary)]">(optional)</span>;

  return (
    <div className="auth-pattern min-h-dvh flex flex-col items-center justify-center px-6 py-8 bg-[var(--bg-base)]">
      <button
        type="button"
        onClick={() => setThemePreference(cycleThemePreference(preference))}
        aria-label={`Switch theme, currently ${preference}`}
        className={cn(
          'absolute top-4 right-4 z-10 p-3 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors',
          focusRing
        )}
      >
        <ThemeIcon className="h-5 w-5" />
      </button>
      <div className="relative z-[1] w-full max-w-md space-y-8 animate-auth-enter">
        <div className="text-center space-y-1">
          <BrandIcon className="h-16 w-16 mx-auto text-[var(--accent)] mb-3" />
          <h1 className="font-heading text-[28px] font-bold text-[var(--text-primary)] tracking-tight">
            {settings.appName}
          </h1>
          <p className="text-[14px] text-[var(--text-tertiary)]">Create your account</p>
        </div>

        {invitePreview && (
          <div className="flat-card rounded-[var(--radius-lg)] flex items-center gap-3 px-4 py-3 text-[14px]">
            <Users className="h-5 w-5 text-[var(--accent)] shrink-0" />
            <span>
              You've been invited to join <strong>{invitePreview.name}</strong>
              <span className="text-[var(--text-tertiary)]"> · {invitePreview.memberCount} {invitePreview.memberCount === 1 ? 'member' : 'members'}</span>
            </span>
          </div>
        )}
        {inviteInvalid && (
          <div className="flat-card rounded-[var(--radius-lg)] flex items-center gap-3 px-4 py-3 text-[14px] bg-[var(--color-warning-soft)]">
            <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] shrink-0" />
            <span>
              This invite code is invalid or expired.{' '}
              <span className="text-[var(--text-tertiary)]">Ask your team for a new one.</span>
            </span>
          </div>
        )}

        {!statusLoaded ? (
          <Card>
            <CardContent className="py-6">
              <div className="space-y-5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-20 animate-shimmer rounded" />
                    <div className="h-11 animate-shimmer rounded-[var(--radius-sm)]" />
                  </div>
                ))}
                <div className="h-11 animate-shimmer rounded-[var(--radius-md)]" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="py-6">
                <form onSubmit={handleSubmit} noValidate>
                  {/* Account details */}
                  <fieldset className="space-y-4">
                    <legend className="sr-only">Account details</legend>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="reg-username">Username</Label>
                        {username.length > 0 && (
                          <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">{username.length}/50</span>
                        )}
                      </div>
                      <Input
                        ref={usernameRef}
                        id="reg-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onBlur={() => markTouched('username')}
                        placeholder="Letters, numbers, underscores"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoFocus
                        required
                        enterKeyHint="next"
                        aria-invalid={touched.username && !!fieldErrors.username}
                        aria-describedby={touched.username && fieldErrors.username ? 'reg-username-error' : undefined}
                      />
                      {touched.username && fieldErrors.username && (
                        <p id="reg-username-error" role="alert" className="text-[13px] text-[var(--destructive)]">{fieldErrors.username}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-display-name">Display Name {optionalHint}</Label>
                      <Input
                        id="reg-display-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="How you appear to others"
                        autoComplete="name"
                        enterKeyHint="next"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email{selfHosted && <> {optionalHint}</>}</Label>
                      <Input
                        ref={emailRef}
                        id="reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => markTouched('email')}
                        placeholder={selfHosted ? 'For password recovery' : 'Required for account recovery'}
                        autoComplete="email"
                        required={!selfHosted}
                        enterKeyHint="next"
                        aria-invalid={touched.email && !!fieldErrors.email}
                        aria-describedby={touched.email && fieldErrors.email ? 'reg-email-error' : undefined}
                      />
                      {touched.email && fieldErrors.email && (
                        <p id="reg-email-error" role="alert" className="text-[13px] text-[var(--destructive)]">{fieldErrors.email}</p>
                      )}
                    </div>
                  </fieldset>

                  <div className="h-px bg-[var(--border-subtle)] my-5" />

                  {/* Password */}
                  <fieldset className="space-y-4">
                    <legend className="sr-only">Password</legend>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <PasswordInput
                        ref={passwordRef}
                        id="reg-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 chars, mixed case & number"
                        autoComplete="new-password"
                        required
                        enterKeyHint="next"
                      />
                      {password.length > 0 && (
                        <div className="pt-1">
                          <PasswordChecklist checks={passwordChecks} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="reg-confirm">Confirm Password</Label>
                        {passwordsMatch && (
                          <Check className="h-3.5 w-3.5 text-[var(--color-success)] animate-check-pop" aria-label="Passwords match" />
                        )}
                      </div>
                      <PasswordInput
                        ref={confirmRef}
                        id="reg-confirm"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={() => markTouched('confirmPassword')}
                        placeholder="Repeat password"
                        autoComplete="new-password"
                        required
                        enterKeyHint="next"
                        aria-invalid={touched.confirmPassword && !!fieldErrors.confirmPassword}
                        aria-describedby={touched.confirmPassword && fieldErrors.confirmPassword ? 'reg-confirm-error' : undefined}
                      />
                      {touched.confirmPassword && fieldErrors.confirmPassword && (
                        <p id="reg-confirm-error" role="alert" className="text-[13px] text-[var(--destructive)]">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>
                  </fieldset>

                  <div className="h-px bg-[var(--border-subtle)] my-5" />

                  {/* Invite code */}
                  <fieldset className="space-y-4">
                    <legend className="sr-only">Invitation</legend>
                    <div className="space-y-2">
                      <Label htmlFor="reg-invite">
                        Invite Code{registrationMode !== 'invite' && <> {optionalHint}</>}
                      </Label>
                      <Input
                        ref={inviteRef}
                        id="reg-invite"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        onBlur={() => markTouched('inviteCode')}
                        placeholder="Paste invite code to auto-join"
                        enterKeyHint="done"
                        required={registrationMode === 'invite'}
                        aria-invalid={touched.inviteCode && !!fieldErrors.inviteCode}
                        aria-describedby={touched.inviteCode && fieldErrors.inviteCode ? 'reg-invite-error' : undefined}
                      />
                      {touched.inviteCode && fieldErrors.inviteCode && (
                        <p id="reg-invite-error" role="alert" className="text-[13px] text-[var(--destructive)]">{fieldErrors.inviteCode}</p>
                      )}
                    </div>
                  </fieldset>

                  <div className="mt-6 space-y-4">
                    <Button
                      type="submit"
                      disabled={!username.trim() || !password || !confirmPassword || loading}
                      fullWidth
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {loading ? 'Creating account...' : 'Create Account'}
                    </Button>
                    <p className="text-center text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                      By creating an account, you agree to the{' '}
                      <Link to="/terms" className="text-[var(--accent)] hover:underline focus-visible:underline focus-visible:outline-none">Terms of Service</Link>
                      {' '}and{' '}
                      <Link to="/privacy" className="text-[var(--accent)] hover:underline focus-visible:underline focus-visible:outline-none">Privacy Policy</Link>.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>

            <p className="text-center text-[14px] text-[var(--text-secondary)]">
              Already have an account?{' '}
              <Link to="/login" className="text-[var(--accent)] font-medium hover:underline focus-visible:underline focus-visible:outline-none">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
