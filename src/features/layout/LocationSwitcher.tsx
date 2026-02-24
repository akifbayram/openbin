import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/lib/useClickOutside';
import { Badge } from '@/components/ui/badge';
import type { Location } from '@/types';

interface LocationSwitcherProps {
  locations: Location[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
}

export function LocationSwitcher({ locations, activeLocationId, onLocationChange }: LocationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (locations.length === 0) return null;

  const active = locations.find((l) => l.id === activeLocationId);

  if (locations.length <= 1) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors text-left',
          open
            ? 'glass-card text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <MapPin className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
        <span className="flex-1 truncate">{active?.name ?? 'Select location'}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="animate-popover-enter absolute left-0 right-0 top-full mt-1.5 z-50 glass-heavy rounded-[var(--radius-lg)] py-1 shadow-lg border border-[var(--border-glass)] max-h-64 overflow-y-auto"
        >
          {locations.map((loc) => {
            const isActive = loc.id === activeLocationId;
            return (
              <button
                key={loc.id}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onLocationChange(loc.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] transition-colors',
                  isActive
                    ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                )}
              >
                <Check className={cn('h-4 w-4 shrink-0', isActive ? 'text-[var(--accent)]' : 'invisible')} />
                <span className="flex-1 truncate">{loc.name}</span>
                {loc.role && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {loc.role}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
