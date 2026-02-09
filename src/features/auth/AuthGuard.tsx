import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg-base)]">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--bg-active)] border-t-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
