import { useState } from 'react';
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
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

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
                'flex items-center py-2 rounded-[var(--radius-full)] text-[13px] font-medium',
                prefersReducedMotion ? '' : 'transition-all duration-300',
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-sm px-4'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] w-11 justify-center'
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span
                className={cn(
                  'whitespace-nowrap overflow-hidden',
                  prefersReducedMotion ? '' : 'transition-all duration-300',
                  isActive ? 'max-w-[80px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0',
                )}
              >
                {displayLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
