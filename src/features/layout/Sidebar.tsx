import { BookOpen, ClipboardList, Github, LayoutDashboard, LogOut, MapPin, Package, PanelLeftClose, PanelLeftOpen, Printer, ScanLine, Settings, Tags } from
  'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserAvatar } from '@/components/ui/user-avatar';
import { getAvatarUrl } from '@/lib/api';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import type { TermKey } from '@/lib/navItems';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { useTerminology } from '@/lib/terminology';
import { useSidebarCollapsed } from '@/lib/useSidebarCollapsed';
import { cn } from '@/lib/utils';
import type { Location as LocationType } from '@/types';
import { LocationSwitcher } from './LocationSwitcher';

/* Sidebar‐collapsed‐width is 64px. With px-3 (12px) container padding and
   px-2 (8px) button padding, the icon left edge sits at 20px from the sidebar
   edge → icon center at 30px. Close enough to visual center (32px) and
   identical in both collapsed and expanded states, so icons never shift. */

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

const brandIcon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-5.5 w-5.5 text-[var(--accent)] shrink-0">
    <path d="M 4 4 L 10 4 L 10 10 L 4 10 L 4 4 M 20 4 L 20 10 L 14 10 L 14 4 L 20 4 M 14 15 L 16 15 L 16 13 L 14 13 L 14 11 L 16 11 L 16 13 L 18 13 L 18 11
  L 20 11 L 20 13 L 18 13 L 18 15 L 20 15 L 20 18 L 18 18 L 18 20 L 16 20 L 16 18 L 13 18 L 13 20 L 11 20 L 11 16 L 14 16 L 14 15 M 16 15 L 16 18 L 18 18 L 18
   15 L 16 15 M 4 20 L 4 14 L 10 14 L 10 20 L 4 20 M 6 6 L 6 8 L 8 8 L 8 6 L 6 6 M 16 6 L 16 8 L 18 8 L 18 6 L 16 6 M 6 16 L 6 18 L 8 18 L 8 16 L 6 16 M 4 11
  L 6 11 L 6 13 L 4 13 L 4 11 M 9 11 L 13 11 L 13 15 L 11 15 L 11 13 L 9 13 L 9 11 M 11 6 L 13 6 L 13 10 L 11 10 L 11 6 M 2 3 L 2 22 L 22 22 L 22 3 A 1 1 0 0
  1 24 3 L 24 22 A 2 2 0 0 1 22 24 L 2 24 A 2 2 0 0 1 0 22 L 0 3 A 1 1 0 0 1 2 3 Z" />
  </svg>
);

const discordIcon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
  </svg>
);

function NavButton({ path, label, icon: Icon, currentPath, navigate, onClick, collapsed }: {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  currentPath: string;
  navigate: (path: string) => void;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  const isActive = path === '/bins'
    ? currentPath === '/bins' || currentPath.startsWith('/bin/')
    : currentPath === path;

  return (
    <button
      type="button"
      onClick={() => { navigate(path); onClick?.(); }}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium w-full overflow-hidden whitespace-nowrap text-left',
        isActive
          ? 'glass-card text-[var(--text-primary)]'
          : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-[var(--accent)]')} />
      <span className={cn('truncate', collapsed && 'w-0 opacity-0')} aria-hidden={collapsed || undefined}>
        {label}
      </span>
    </button>
  );
}

interface SidebarContentProps {
  locations: LocationType[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
  onItemClick?: () => void;
  onScanClick?: () => void;
  collapsed?: boolean;
}

export function SidebarContent({ locations, activeLocationId, onLocationChange, onItemClick, onScanClick, collapsed }: SidebarContentProps) {
  const location = useLocation();
  const rawNavigate = useNavigate();
  const { guardedNavigate } = useNavigationGuard();
  const navigate = (path: string) => guardedNavigate(() => rawNavigate(path));
  const { settings } = useAppSettings();
  const t = useTerminology();
  const { user, logout } = useAuth();

  return (
    <>
      <div className="flex-1 flex flex-col pt-6 pb-4 px-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2 pt-2 pb-4 overflow-hidden">
          {brandIcon}
          {/* biome-ignore lint/a11y/useHeadingContent: heading has dynamic text content and aria-label */}
          <h1 className={cn(
            'text-[22px] font-bold text-[var(--text-primary)] tracking-tight leading-none truncate',
            collapsed && 'w-0 opacity-0'
          )} aria-hidden={collapsed || undefined} aria-label={settings.appName}>
            {settings.appName}
          </h1>
        </div>

        {/* Top: Home, Bins */}
        <div className="space-y-1">
          {/* Location switcher */}
          {collapsed ? (
            locations.length > 1 && (
              <button
                type="button"
                onClick={() => { navigate('/locations'); onItemClick?.(); }}
                aria-label={t.Locations ?? 'Locations'}
                className="flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium w-full text-[var(--text-tertiary)]
  hover:bg-[var(--bg-hover)]"
              >
                <MapPin className="h-5 w-5 shrink-0" />
              </button>
            )
          ) : (
            <LocationSwitcher
              locations={locations}
              activeLocationId={activeLocationId}
              onLocationChange={(id) => { onLocationChange(id); onItemClick?.(); }}
            />
          )}
          {topItems.map((item) => (
            <NavButton key={item.path} {...item} label={item.termKey ? t[item.termKey] : item.label} currentPath={location.pathname} navigate={navigate}
              onClick={onItemClick} collapsed={collapsed} />
          ))}
        </div>

        {/* Spacer top */}
        <div className="flex-1" />

        {/* Manage section */}
        <div className="space-y-1">
          <p className={cn(
            'px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] overflow-hidden',
            collapsed ? 'h-0 opacity-0' : 'pb-1'
          )} aria-hidden={collapsed || undefined}>
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
                collapsed={collapsed}
              />
            ) : (
              <NavButton key={item.path} {...item} label={item.termKey ? t[item.termKey] : item.label} currentPath={location.pathname} navigate={navigate}
                onClick={onItemClick} collapsed={collapsed} />
            )
          )}
        </div>

        {/* Spacer bottom */}
        <div className="flex-1" />
      </div>

      {/* Administration section */}
      <div className="py-4 border-t border-[var(--border-subtle)] px-3">
        <p className={cn(
          'px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] overflow-hidden',
          collapsed ? 'h-0 opacity-0' : 'pb-1'
        )} aria-hidden={collapsed || undefined}>
          Administration
        </p>
        <div className="space-y-1">
          {user && (
            <button
              type="button"
              onClick={() => { navigate('/profile'); onItemClick?.(); }}
              aria-label={user.displayName || user.username}
              aria-current={location.pathname === '/profile' ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium w-full overflow-hidden whitespace-nowrap text-left',
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
              <span className={cn('flex-1 truncate', collapsed && 'w-0 opacity-0')} aria-hidden={collapsed || undefined}>
                {user.displayName || user.username}
              </span>
            </button>
          )}
          <NavButton path="/settings" label="Settings" icon={Settings} currentPath={location.pathname} navigate={navigate} onClick={onItemClick}
            collapsed={collapsed} />
          <button
            type="button"
            onClick={() => { logout(); onItemClick?.(); }}
            aria-label="Sign Out"
            className="flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]
  w-full overflow-hidden whitespace-nowrap"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn('truncate', collapsed && 'w-0 opacity-0')} aria-hidden={collapsed || undefined}>
              Sign Out
            </span>
          </button>
        </div>
      </div>

      {/* External links + version */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-[var(--border-subtle)]">
        <a href="https://docs.openbin.app/" target="_blank" rel="noopener noreferrer" title="Documentation"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
          <BookOpen className="h-4 w-4" />
        </a>
        <a href="https://discord.gg/W6JPZCqqx9" target="_blank" rel="noopener noreferrer" title="Discord"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
          {discordIcon}
        </a>
        <a href="https://github.com/akifbayram/openbin" target="_blank" rel="noopener noreferrer" title="GitHub"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
          <Github className="h-4 w-4" />
        </a>
        <span className={cn(
          'ml-auto text-xs text-[var(--text-tertiary)] tabular-nums',
          collapsed && 'w-0 opacity-0 overflow-hidden'
        )} aria-hidden={collapsed || undefined}>
          v{__APP_VERSION__}
        </span>
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
  const { isCollapsed, toggle } = useSidebarCollapsed();

  return (
    <aside
      aria-label="Main navigation"
      className="hidden lg:flex flex-col h-dvh fixed left-0 top-0 z-30 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] print-hide
  transition-[width] duration-200 ease-in-out"
      style={{ width: isCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <SidebarContent locations={locations} activeLocationId={activeLocationId} onLocationChange={onLocationChange} onScanClick={onScanClick}
          collapsed={isCollapsed} />
      </div>

      {/* Edge-mounted toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!isCollapsed}
        className="absolute top-[43px] right-0 translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full glass-heavy
  text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)]
  focus-visible:outline-none"
      >
        {isCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}