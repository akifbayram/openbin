import { LayoutDashboard, Menu, Package, ScanLine, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onNavigate: (path: string) => void;
  onScanClick: () => void;
  onMoreClick: () => void;
  onAskAi?: () => void;
}

export function BottomNav({ onNavigate, onScanClick, onMoreClick, onAskAi }: BottomNavProps) {
  const { pathname } = useLocation();

  const items = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, action: () => onNavigate('/'), active: pathname === '/' },
    { id: 'bins', label: 'Bins', icon: Package, action: () => onNavigate('/bins'), active: pathname === '/bins' || pathname.startsWith('/bin/') },
    { id: 'scan', label: 'Scan', icon: ScanLine, action: () => onScanClick(), active: false },
    ...(onAskAi
      ? [{ id: 'ai', label: 'Ask AI', icon: Sparkles, action: onAskAi, active: false }]
      : []),
    { id: 'more', label: 'More', icon: Menu, action: () => onMoreClick(), active: false },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden print-hide"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div
        className="mx-3 mb-2 flex items-center justify-around rounded-2xl border border-[var(--bottom-bar-border)]"
        style={{
          height: 'var(--bottom-bar-height)',
          background: 'var(--bottom-bar-bg)',
        }}
      >
        {items.map(({ id, label, icon: Icon, action, active }) => (
          <button
            key={id}
            type="button"
            onClick={action}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center justify-center gap-[1px] flex-1 h-full',
              active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]',
            )}
          >
            {/* Active pill indicator */}
            <span
              className={cn(
                'absolute inset-x-1.5 inset-y-1.5 rounded-xl transition-opacity duration-200 motion-reduce:transition-none',
                active ? 'opacity-100' : 'opacity-0',
              )}
              style={{ background: 'var(--tab-pill-bg)' }}
            />
            <Icon
              className={cn(
                'relative z-[1] h-[22px] w-[22px] transition-colors duration-200 motion-reduce:transition-none',
              )}
              strokeWidth={active ? 2.2 : 1.8}
            />
            <span className={cn(
              'relative z-[1] text-[10px] font-medium leading-tight transition-colors duration-200 motion-reduce:transition-none',
            )}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
