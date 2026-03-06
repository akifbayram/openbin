import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-100 dark:bg-gray-950">
        <div className="h-8 w-8 rounded-full border-2 border-gray-500/18 dark:border-gray-500/28 border-t-purple-600 dark:border-t-purple-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
