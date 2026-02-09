import { useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navItems } from '@/lib/navItems';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { HomeSelector } from '@/features/homes/HomeSelector';

interface SidebarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const { user, logout } = useAuth();

  return (
    <aside aria-label="Main navigation" className="hidden lg:flex flex-col w-[260px] h-dvh fixed left-0 top-0 print-hide">
      <div className="flex-1 flex flex-col px-5 pt-6 pb-4 gap-1">
        {/* Brand */}
        <div className="px-3 pt-2 pb-4">
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
            {settings.appName}
          </h1>
          {settings.appSubtitle && (
            <p className="text-[12px] text-[var(--text-tertiary)] mt-1">{settings.appSubtitle}</p>
          )}
        </div>

        {/* Home selector */}
        <HomeSelector />

        {/* Nav items */}
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/bin/')
              : location.pathname === path;

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium transition-all duration-200 w-full text-left',
                isActive
                  ? 'glass-card text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Bottom section: user info + theme toggle */}
      <div className="px-5 py-4 border-t border-[var(--border-subtle)] space-y-1">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 text-[14px] text-[var(--text-secondary)]">
            <div className="h-7 w-7 rounded-full bg-[var(--bg-active)] flex items-center justify-center text-[12px] font-semibold shrink-0">
              {user.displayName?.[0]?.toUpperCase() || user.username[0].toUpperCase()}
            </div>
            <span className="flex-1 truncate">{user.displayName || user.username}</span>
          </div>
        )}
        <button
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors w-full"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
