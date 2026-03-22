import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Location } from '@/types';

interface LocationSelectListProps {
  locations: Location[];
  value: string | null;
  onChange: (id: string) => void;
  emptyMessage?: string;
}

export function LocationSelectList({ locations, value, onChange, emptyMessage }: LocationSelectListProps) {
  if (locations.length === 0 && emptyMessage) {
    return (
      <p className="text-[13px] text-[var(--text-tertiary)] text-center py-4">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {locations.map((l) => {
        const isSelected = value === l.id;
        const counts = [
          l.bin_count != null ? `${l.bin_count} bins` : null,
          l.area_count != null ? `${l.area_count} areas` : null,
        ].filter(Boolean).join(' \u00b7 ');
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onChange(l.id)}
            aria-pressed={isSelected}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] transition-colors border flex items-center',
              isSelected
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'text-[var(--text-primary)] border-[var(--border-flat)] hover:border-[var(--text-tertiary)]'
            )}
          >
            <div className="flex-1 min-w-0">
              <span className="text-[15px] truncate block">{l.name}</span>
              {counts && (
                <span className={cn('text-[13px]', isSelected ? 'text-white/70' : 'text-[var(--text-tertiary)]')}>
                  {counts}
                </span>
              )}
            </div>
            <Check className={cn('h-4 w-4 shrink-0 ml-2 transition-opacity', isSelected ? 'opacity-100' : 'opacity-0')} />
          </button>
        );
      })}
    </div>
  );
}
