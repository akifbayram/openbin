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
    <div className="flex flex-col gap-1">
      {locations.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange(l.id)}
          className={cn(
            'w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] text-[15px] transition-colors',
            value === l.id
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          )}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}
