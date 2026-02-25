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
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

interface SidebarContentProps {
  locations: LocationType[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
  onItemClick?: () => void;
}

export function SidebarContent({ locations, activeLocationId, onLocationChange, onItemClick }: SidebarContentProps) {
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
        <div className="px-3 pt-2 pb-4">
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
          {manageItems.map((item) => (
            <NavButton key={item.path} {...item} label={item.termKey ? t[item.termKey] : item.label} currentPath={location.pathname} navigate={navigate} onClick={onItemClick} />
          ))}
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
}

export function Sidebar({ locations, activeLocationId, onLocationChange }: SidebarProps) {
  return (
    <aside aria-label="Main navigation" className="hidden lg:flex flex-col w-[260px] h-dvh fixed left-0 top-0 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] print-hide">
      <SidebarContent locations={locations} activeLocationId={activeLocationId} onLocationChange={onLocationChange} />
    </aside>
  );
}
