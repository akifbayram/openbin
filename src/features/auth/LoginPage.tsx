import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { useAppSettings } from '@/lib/appSettings';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const { settings } = useAppSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg-base)]">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">
            {settings.appName}
          </h1>
          {settings.appSubtitle && (
            <p className="text-[14px] text-[var(--text-tertiary)] mt-1">{settings.appSubtitle}</p>
          )}
        </div>

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

        <p className="text-center text-[14px] text-[var(--text-secondary)]">
          Don't have an account?{' '}
          <Link to="/register" className="text-[var(--accent)] font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
