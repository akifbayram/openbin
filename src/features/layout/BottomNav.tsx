import { LayoutDashboard, MoreHorizontal, Package, Printer, ScanLine } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onNavigate: (path: string) => void;
  onScanClick: () => void;
  onMoreClick: () => void;
}

export function BottomNav({ onNavigate, onScanClick, onMoreClick }: BottomNavProps) {
  const { pathname } = useLocation();

  const items = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, action: () => onNavigate('/'), active: pathname === '/' },
    { id: 'bins', label: 'Bins', icon: Package, action: () => onNavigate('/bins'), active: pathname === '/bins' || pathname.startsWith('/bin/') },
    { id: 'scan', label: 'Scan', icon: ScanLine, action: () => onScanClick(), active: false, accent: true },
    { id: 'print', label: 'Print', icon: Printer, action: () => onNavigate('/print'), active: pathname === '/print' },
    { id: 'more', label: 'More', icon: MoreHorizontal, action: () => onMoreClick(), active: false },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden print-hide bg-[var(--bg-sidebar)] border-t border-[var(--border-subtle)]"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="flex items-center justify-around" style={{ height: 'var(--bottom-bar-height)' }}>
        {items.map(({ id, label, icon: Icon, action, active, accent }) => (
          <button
            key={id}
            type="button"
            onClick={action}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-150',
              accent
                ? 'text-[var(--accent)]'
                : active
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-tertiary)]',
            )}
          >
            <Icon className={cn('h-5 w-5', accent && 'h-6 w-6')} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
