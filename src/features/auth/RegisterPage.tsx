import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Sun, Moon, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { useAppSettings } from '@/lib/appSettings';
import { useTheme, cycleThemePreference } from '@/lib/theme';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showToast } = useToast();
  const { settings } = useAppSettings();
  const { preference, setThemePreference } = useTheme();
  const ThemeIcon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.registrationEnabled === false) {
          showToast({ message: 'Registration is currently disabled' });
          navigate('/login');
        }
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
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      showToast({ message: error });
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), password, displayName.trim() || username.trim());
      navigate('/');
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Registration failed',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg-base)] relative">
      <button
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
          <p className="text-[14px] text-[var(--text-tertiary)] mt-1">Create your account</p>
        </div>

        <Card>
          <CardContent className="py-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reg-username">Username</Label>
                <Input
                  id="reg-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Letters, numbers, underscores"
                  autoComplete="username"
                  autoFocus
                  required
                />
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
                  <ul className="space-y-1 pt-1.5 text-[13px]">
                    {([
                      ['length', 'At least 8 characters'],
                      ['uppercase', 'Contains an uppercase letter'],
                      ['lowercase', 'Contains a lowercase letter'],
                      ['digit', 'Contains a number'],
                    ] as const).map(([key, label]) => (
                      <li key={key} className="flex items-center gap-1.5">
                        {passwordChecks[key] ? (
                          <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border-default)]" />
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
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
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
