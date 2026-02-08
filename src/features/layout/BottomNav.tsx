import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navItems } from '@/lib/navItems';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-[calc(12px+var(--safe-bottom))] left-1/2 -translate-x-1/2 z-40 lg:hidden print-hide">
      <div className="glass-nav rounded-[var(--radius-full)] flex items-center gap-1 px-1.5 h-[var(--nav-height)]">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/bin/')
              : location.pathname === path;

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-[var(--radius-full)] text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] px-3.5'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {isActive && <span>{label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
