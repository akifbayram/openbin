import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { useTheme } from '@/lib/theme';

export function AppLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      {/* pb: nav-height(52) + bottom-offset(20) + safe-area + breathing(16) ≈ 88+safe */}
      <main className="lg:ml-[var(--sidebar-width)] pb-[calc(88px+var(--safe-bottom))] lg:pb-8">
        <div className="mx-auto w-full max-w-2xl">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
