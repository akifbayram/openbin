import { Check } from 'lucide-react';
import { useMemo } from 'react';
import { useBinList } from '@/features/bins/useBins';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { cn, focusRing } from '@/lib/utils';
import { BinIconBadge } from './bin-icon-badge';
import { SearchInput } from './search-input';

export interface BinPickerListProps {
  excludeBinId?: string;
  selectedBinId: string | null;
  onSelect: (binId: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  /** When true, the bin list is fetched lazily (not until visible). */
  paused?: boolean;
  emptyText?: string;
}

export function BinPickerList({
  excludeBinId,
  selectedBinId,
  onSelect,
  search,
  onSearchChange,
  paused,
  emptyText = 'No other bins available',
}: BinPickerListProps) {
  const { bins } = useBinList(undefined, 'name', undefined, paused);

  const filtered = useMemo(() => {
    let list = excludeBinId ? bins.filter((b) => b.id !== excludeBinId) : bins;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) =>
        b.name.toLowerCase().includes(q) || b.area_name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [bins, excludeBinId, search]);

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={search ? () => onSearchChange('') : undefined}
        placeholder="Search bins..."
      />
      <div className="max-h-52 overflow-y-auto flex flex-col gap-1">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)] text-center py-4">
            {search ? 'No matching bins' : emptyText}
          </p>
        ) : (
          filtered.map((b) => {
            const BinIcon = resolveIcon(b.icon);
            const colorPreset = resolveColor(b.color);
            const isSelected = selectedBinId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(b.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] transition-colors duration-150 flex items-center gap-2 border',
                  focusRing,
                  isSelected
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                    : 'border-transparent hover:bg-[var(--bg-hover)]',
                )}
              >
                <BinIconBadge icon={BinIcon} colorPreset={colorPreset} />
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] truncate block text-[var(--text-primary)]">{b.name}</span>
                  {b.area_name && (
                    <span className="text-[12px] text-[var(--text-tertiary)] truncate block">{b.area_name}</span>
                  )}
                </div>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
