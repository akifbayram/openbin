import { Plus, LogIn, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Location } from '@/types';

interface LocationSwitcherProps {
  locations: Location[];
  activeLocationId: string | null;
  onSelect: (id: string) => void;
  onCreateClick: () => void;
  onJoinClick: () => void;
  isLoading: boolean;
}

export function LocationSwitcher({ locations, activeLocationId, onSelect, onCreateClick, onJoinClick, isLoading }: LocationSwitcherProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-[var(--radius-full)]" />
        ))}
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
        <MapPin className="h-16 w-16 opacity-40" />
        <div className="text-center space-y-1.5">
          <p className="text-[17px] font-semibold text-[var(--text-secondary)]">No locations yet</p>
          <p className="text-[13px]">Create a location or join one with an invite code</p>
        </div>
        <div className="flex gap-2.5">
          <Button onClick={onJoinClick} variant="outline" className="rounded-[var(--radius-full)]">
            <LogIn className="h-4 w-4 mr-2" />
            Join Location
          </Button>
          <Button onClick={onCreateClick} className="rounded-[var(--radius-full)]">
            <Plus className="h-4 w-4 mr-2" />
            Create Location
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
      {locations.map((loc) => {
        const isActive = loc.id === activeLocationId;
        return (
          <button
            key={loc.id}
            onClick={() => onSelect(loc.id)}
            className={cn(
              'shrink-0 max-w-[120px] truncate px-3.5 py-2 rounded-[var(--radius-full)] text-[14px] font-medium transition-all duration-200',
              isActive
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'glass-card text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {loc.name}
          </button>
        );
      })}
    </div>
  );
}
