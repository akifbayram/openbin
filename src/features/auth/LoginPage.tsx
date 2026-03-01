import { LogIn, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { cycleThemePreference, useTheme } from '@/lib/theme';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const { settings } = useAppSettings();
  const { preference, setThemePreference } = useTheme();
  const ThemeIcon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        setRegistrationEnabled(data.registrationEnabled !== false);
        if (data.demoMode) setDemoMode(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!demoMode) return;
    let cancelled = false;
    setDemoLoading(true);
    apiFetch('/api/auth/demo-login', { method: 'POST' })
      .then(() => {
        if (!cancelled) {
          window.location.href = '/';
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDemoLoading(false);
          setDemoMode(false);
          showToast({ message: 'Demo login failed. Please sign in manually.' });
        }
      });
    return () => { cancelled = true; };
  }, [demoMode, showToast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Login failed',
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

        {demoLoading ? (
          <div className="text-center space-y-4">
            <div className="h-8 w-8 mx-auto border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[14px] text-[var(--text-secondary)]">Entering demo...</p>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="py-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      autoComplete="username"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!username.trim() || !password || loading}
                    className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {registrationEnabled && (
              <p className="text-center text-[14px] text-[var(--text-secondary)]">
                Don't have an account?{' '}
                <Link to="/register" className="text-[var(--accent)] font-medium hover:underline">
                  Create one
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
