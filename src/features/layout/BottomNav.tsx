import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navItems, settingsNavItem } from '@/lib/navItems';
import { useNavigationGuard } from '@/lib/navigationGuard';
import { useTerminology } from '@/lib/terminology';

export function BottomNav() {
  const location = useLocation();
  const rawNavigate = useNavigate();
  const { guardedNavigate } = useNavigationGuard();
  const navigate = (path: string) => guardedNavigate(() => rawNavigate(path));
  const t = useTerminology();

  return (
    <nav aria-label="Main navigation" className="fixed bottom-[calc(12px+var(--safe-bottom))] left-1/2 -translate-x-1/2 z-40 lg:hidden print-hide">
      <div className="glass-nav rounded-[var(--radius-full)] flex items-center gap-1 px-1.5 h-[var(--nav-height)]">
        {[...navItems, settingsNavItem].map(({ path, label, icon: Icon, termKey }) => {
          const isActive = path === '/bins'
            ? location.pathname === '/bins' || location.pathname.startsWith('/bin/')
            : location.pathname === path;
          const displayLabel = termKey ? t[termKey] : label;

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={displayLabel}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 py-2 rounded-[var(--radius-full)] text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-sm px-4'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] w-11 justify-center'
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {isActive && <span className="whitespace-nowrap">{displayLabel}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
