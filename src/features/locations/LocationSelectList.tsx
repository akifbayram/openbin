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
      <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center py-4">
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
              ? 'bg-purple-600 dark:bg-purple-500 text-white'
              : 'hover:bg-gray-500/8 dark:hover:bg-gray-500/18'
          )}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}
