import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, MapPin, ClipboardList, Tags, Printer, ScanLine, Clock, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSettings } from '@/lib/appSettings';
import { useTerminology } from '@/lib/terminology';
import type { TermKey } from '@/lib/navItems';
import { useAuth } from '@/lib/auth';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { usePermissions } from '@/lib/usePermissions';
import { getAvatarUrl } from '@/lib/api';
import { UserAvatar } from '@/components/ui/user-avatar';
import { LocationSwitcher } from './LocationSwitcher';
import type { Location as LocationType } from '@/types';

const topItems: { path: string; label: string; icon: React.ComponentType<{ className?: string }>; termKey?: TermKey }[] = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/bins', label: 'Bins', icon: Package, termKey: 'Bins' },
];

const manageItems: { path: string; label: string; icon: React.ComponentType<{ className?: string }>; termKey?: TermKey }[] = [
  { path: '/locations', label: 'Locations', icon: MapPin, termKey: 'Locations' },
  { path: '/items', label: 'Items', icon: ClipboardList },
  { path: '/tags', label: 'Tags', icon: Tags },
  { path: '/print', label: 'Print', icon: Printer },
  { path: '/scan', label: 'Scan', icon: ScanLine },
];

function NavButton({ path, label, icon: Icon, currentPath, navigate, onClick }: {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  currentPath: string;
  navigate: (path: string) => void;
  onClick?: () => void;
}) {
  const isActive = path === '/bins'
    ? currentPath === '/bins' || currentPath.startsWith('/bin/')
    : currentPath === path;

  return (
    <button
      onClick={() => { navigate(path); onClick?.(); }}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium transition-all duration-200 w-full text-left',
        isActive
          ? 'glass-card text-[var(--text-primary)]'
          : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
      )}
    >
      <Icon className={cn('h-5 w-5', isActive && 'text-[var(--accent)]')} />
      {label}
    </button>
  );
}

interface SidebarContentProps {
  locations: LocationType[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
  onItemClick?: () => void;
  onScanClick?: () => void;
}

export function SidebarContent({ locations, activeLocationId, onLocationChange, onItemClick, onScanClick }: SidebarContentProps) {
  const location = useLocation();
  const rawNavigate = useNavigate();
  const { guardedNavigate } = useNavigationGuard();
  const navigate = (path: string) => guardedNavigate(() => rawNavigate(path));
  const { settings } = useAppSettings();
  const t = useTerminology();
  const { user, logout } = useAuth();
  const { isAdmin } = usePermissions();

  return (
    <>
      <div className="flex-1 flex flex-col px-5 pt-6 pb-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3 pt-2 pb-4">
          <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-5.5 w-5.5 text-[var(--accent)] shrink-0">
            <path d="M 4 4 L 10 4 L 10 10 L 4 10 L 4 4 M 20 4 L 20 10 L 14 10 L 14 4 L 20 4 M 14 15 L 16 15 L 16 13 L 14 13 L 14 11 L 16 11 L 16 13 L 18 13 L 18 11 L 20 11 L 20 13 L 18 13 L 18 15 L 20 15 L 20 18 L 18 18 L 18 20 L 16 20 L 16 18 L 13 18 L 13 20 L 11 20 L 11 16 L 14 16 L 14 15 M 16 15 L 16 18 L 18 18 L 18 15 L 16 15 M 4 20 L 4 14 L 10 14 L 10 20 L 4 20 M 6 6 L 6 8 L 8 8 L 8 6 L 6 6 M 16 6 L 16 8 L 18 8 L 18 6 L 16 6 M 6 16 L 6 18 L 8 18 L 8 16 L 6 16 M 4 11 L 6 11 L 6 13 L 4 13 L 4 11 M 9 11 L 13 11 L 13 15 L 11 15 L 11 13 L 9 13 L 9 11 M 11 6 L 13 6 L 13 10 L 11 10 L 11 6 M 2 3 L 2 22 L 22 22 L 22 3 A 1 1 0 0 1 24 3 L 24 22 A 2 2 0 0 1 22 24 L 2 24 A 2 2 0 0 1 0 22 L 0 3 A 1 1 0 0 1 2 3 Z" />
          </svg>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
            {settings.appName}
          </h1>
        </div>

        {/* Top: Home, Bins */}
        <div className="space-y-1">
          {/* Location switcher */}
          <LocationSwitcher
            locations={locations}
            activeLocationId={activeLocationId}
            onLocationChange={(id) => { onLocationChange(id); onItemClick?.(); }}
          />
          {topItems.map((item) => (
            <NavButton key={item.path} {...item} label={item.termKey ? t[item.termKey] : item.label} currentPath={location.pathname} navigate={navigate} onClick={onItemClick} />
          ))}
        </div>

        {/* Spacer top */}
        <div className="flex-1" />

        {/* Manage section */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Manage
          </p>
          {manageItems.map((item) =>
            item.path === '/scan' ? (
              <NavButton
                key={item.path}
                {...item}
                label={item.label}
                currentPath={location.pathname}
                navigate={() => { onScanClick?.(); onItemClick?.(); }}
                onClick={undefined}
              />
            ) : (
              <NavButton key={item.path} {...item} label={item.termKey ? t[item.termKey] : item.label} currentPath={location.pathname} navigate={navigate} onClick={onItemClick} />
            )
          )}
        </div>

        {/* Spacer bottom */}
        <div className="flex-1" />
      </div>

      {/* Administration section */}
      <div className="px-5 py-4 border-t border-[var(--border-subtle)]">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Administration
        </p>
        <div className="space-y-1">
          {user && (
            <button
              onClick={() => { navigate('/profile'); onItemClick?.(); }}
              aria-current={location.pathname === '/profile' ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium transition-all duration-200 w-full text-left',
                location.pathname === '/profile'
                  ? 'glass-card text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
              )}
            >
              <UserAvatar
                avatarUrl={user.avatarUrl ? getAvatarUrl(user.avatarUrl) : null}
                displayName={user.displayName || user.username}
                size="xs"
              />
              <span className="flex-1 truncate">{user.displayName || user.username}</span>
            </button>
          )}
          {isAdmin && <NavButton path="/activity" label="Activity" icon={Clock} currentPath={location.pathname} navigate={navigate} onClick={onItemClick} />}
          <NavButton path="/settings" label="Settings" icon={Settings} currentPath={location.pathname} navigate={navigate} onClick={onItemClick} />
          <button
            onClick={() => { logout(); onItemClick?.(); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors w-full"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

interface SidebarProps {
  locations: LocationType[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
  onScanClick?: () => void;
}

export function Sidebar({ locations, activeLocationId, onLocationChange, onScanClick }: SidebarProps) {
  return (
    <aside aria-label="Main navigation" className="hidden lg:flex flex-col w-[260px] h-dvh fixed left-0 top-0 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] print-hide">
      <SidebarContent locations={locations} activeLocationId={activeLocationId} onLocationChange={onLocationChange} onScanClick={onScanClick} />
    </aside>
  );
}
