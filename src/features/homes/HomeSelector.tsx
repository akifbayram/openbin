import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Home, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useHomeList } from './useHomes';

export function HomeSelector() {
  const { activeHomeId, setActiveHomeId } = useAuth();
  const { homes } = useHomeList();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeHome = homes.find((h) => h.id === activeHomeId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-select first home if none is active
  useEffect(() => {
    if (!activeHomeId && homes.length > 0) {
      setActiveHomeId(homes[0].id);
    }
  }, [activeHomeId, homes, setActiveHomeId]);

  if (homes.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-[var(--radius-sm)] text-[14px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Home className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate font-medium">
          {activeHome?.name || 'Select Home'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-[var(--radius-md)] border border-[var(--border-subtle)] shadow-lg py-1 max-h-60 overflow-y-auto bg-[var(--bg-elevated)]">
          {homes.map((home) => (
            <button
              key={home.id}
              onClick={() => {
                setActiveHomeId(home.id);
                setOpen(false);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[14px] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="flex-1 text-left truncate text-[var(--text-primary)]">
                {home.name}
              </span>
              {home.id === activeHomeId && (
                <Check className="h-4 w-4 text-[var(--accent)] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
