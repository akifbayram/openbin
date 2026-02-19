import type { Location } from '@/types';

interface LocationTabsProps {
  locations: Location[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function LocationTabs({ locations, activeId, onSelect }: LocationTabsProps) {
  const scrollable = locations.length >= 5;

  return (
    <div
      className={`flex rounded-[var(--radius-sm)] bg-[var(--bg-input)] p-1 gap-1 ${
        scrollable ? 'overflow-x-auto flex-nowrap' : ''
      }`}
    >
      {locations.map((loc) => (
        <button
          type="button"
          key={loc.id}
          onClick={() => onSelect(loc.id)}
          className={`${scrollable ? 'min-w-[100px]' : 'flex-1'} px-3 py-2 rounded-[var(--radius-xs)] text-[14px] font-medium transition-colors truncate min-w-0 ${
            loc.id === activeId
              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {loc.name}
        </button>
      ))}
    </div>
  );
}
