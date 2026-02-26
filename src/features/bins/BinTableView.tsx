import React from 'react';
import { Check, Lock, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Highlight } from '@/components/ui/highlight';
import { SortHeader, type SortDirection } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow as BaseTableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { resolveIcon } from '@/lib/iconMap';
import { resolveColor } from '@/lib/colorPalette';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { formatDate } from '@/lib/formatTime';
import { useBinCardInteraction } from './useBinCardInteraction';
import { areCommonBinCardPropsEqual } from './binMemoUtils';
import type { Bin } from '@/types';
import type { SortOption } from './useBins';

interface BinTableViewProps {
  bins: Bin[];
  sortColumn: SortOption;
  sortDirection: SortDirection;
  onSortChange: (column: SortOption, direction: SortDirection) => void;
  selectable: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string, index: number, shiftKey: boolean) => void;
  searchQuery: string;
  onTagClick: (tag: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
  onSelectAll?: () => void;
}

export function BinTableView({
  bins,
  sortColumn,
  sortDirection,
  onSortChange,
  selectable,
  selectedIds,
  onSelect,
  searchQuery,
  onTagClick,
  onPinToggle,
  onSelectAll,
}: BinTableViewProps) {
  const allSelected = bins.length > 0 && bins.every((b) => selectedIds.has(b.id));

  return (
    <Table>
      {/* Header */}
      <TableHeader>
        {/* Checkbox */}
        <div className="w-6 shrink-0 flex justify-center">
          {selectable && onSelectAll && (
            <button
              type="button"
              onClick={onSelectAll}
              className={cn(
                'h-4 w-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
                allSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-tertiary)]',
              )}
            >
              {allSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
            </button>
          )}
        </div>
        <SortHeader label="Name" column="name" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="flex-[2]" />
        <SortHeader label="Area" column="area" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="hidden md:flex flex-1" />
        <span className="hidden lg:block flex-[1.5] text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Items</span>
        <span className="hidden sm:block flex-1 text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Tags</span>
        <SortHeader label="Updated" column="updated" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} defaultDirection="desc" className="w-20 justify-end" />
      </TableHeader>

      {/* Rows */}
      {bins.map((bin, index) => (
        <BinTableRow
          key={bin.id}
          bin={bin}
          index={index}
          selectable={selectable}
          selected={selectedIds.has(bin.id)}
          onSelect={onSelect}
          searchQuery={searchQuery}
          onTagClick={onTagClick}
          onPinToggle={onPinToggle}
        />
      ))}
    </Table>
  );
}

interface BinTableRowProps {
  bin: Bin;
  index: number;
  selectable: boolean;
  selected: boolean;
  onSelect: (id: string, index: number, shiftKey: boolean) => void;
  searchQuery: string;
  onTagClick: (tag: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
}

const BinTableRow = React.memo(function BinTableRow({
  bin,
  index,
  selectable,
  selected,
  onSelect,
  searchQuery,
  onTagClick,
  onPinToggle,
}: BinTableRowProps) {
  const getTagStyle = useTagStyle();
  const BinIcon = resolveIcon(bin.icon);
  const colorPreset = resolveColor(bin.color);

  const { handleClick, handleKeyDown, longPress } = useBinCardInteraction({ binId: bin.id, index, selectable, onSelect });

  const displayedTags = bin.tags.slice(0, 2);
  const hiddenTagCount = bin.tags.length - displayedTags.length;

  return (
    <BaseTableRow
      tabIndex={0}
      role="button"
      aria-selected={selectable ? selected : undefined}
      className={cn('select-none', selected && 'bg-[var(--bg-active)]')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onContextMenu={longPress.onContextMenu}
    >
      {/* Checkbox */}
      <div className="w-6 shrink-0 flex justify-center">
        {selectable ? (
          <div
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
              selected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-tertiary)]',
            )}
            onClick={(e) => { e.stopPropagation(); onSelect(bin.id, index, e.shiftKey); }}
          >
            {selected && <Check className="h-2.5 w-2.5 text-white animate-check-pop" strokeWidth={3} />}
          </div>
        ) : (
          <div
            className="relative h-5 w-5"
            onClick={(e) => { e.stopPropagation(); onSelect(bin.id, index, e.shiftKey); }}
          >
            {/* Color dot + icon — fades out on hover */}
            <div className="absolute inset-0 flex items-center justify-center gap-1 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-0">
              <div className="h-4 w-4 rounded-full shrink-0" style={colorPreset ? { backgroundColor: colorPreset.dot } : { backgroundColor: 'var(--text-tertiary)' }} />
            </div>
            {/* Checkbox revealed on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100">
              <div className="h-4 w-4 rounded-full border-2 border-[var(--text-tertiary)] flex items-center justify-center" />
            </div>
          </div>
        )}
      </div>

      {/* Name (with icon) */}
      <div className="flex-[2] min-w-0 flex items-center gap-2">
        <BinIcon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
        <span className="truncate font-medium text-[14px] text-[var(--text-primary)]">
          <Highlight text={bin.name} query={searchQuery} />
        </span>
        {bin.visibility === 'private' && (
          <Lock className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
        )}
        {!!bin.is_pinned && !selectable && (
          <button
            onClick={(e) => { e.stopPropagation(); onPinToggle(bin.id, false); }}
            className="shrink-0 text-[var(--accent)]"
            aria-label="Unpin bin"
          >
            <Pin className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        )}
      </div>

      {/* Area */}
      <div className="hidden md:block flex-1 min-w-0">
        {bin.area_name && (
          <Badge variant="outline" className="text-[11px] truncate max-w-full">
            <Highlight text={bin.area_name} query={searchQuery} />
          </Badge>
        )}
      </div>

      {/* Items */}
      <div className="hidden lg:block flex-[1.5] min-w-0">
        {bin.items.length > 0 && (
          <span className="text-[12px] text-[var(--text-tertiary)] truncate block">
            <Highlight text={bin.items.map((i) => i.name).join(', ')} query={searchQuery} />
          </span>
        )}
      </div>

      {/* Tags */}
      <div className="hidden sm:flex flex-1 items-center gap-1 min-w-0 overflow-hidden">
        {displayedTags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="shrink-0 max-w-[5rem] truncate text-[11px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
            style={getTagStyle(tag)}
            onClick={(e) => { e.stopPropagation(); if (!selectable) onTagClick(tag); }}
          >
            {tag}
          </Badge>
        ))}
        {hiddenTagCount > 0 && (
          <Badge variant="secondary" className="shrink-0 text-[11px] opacity-70">
            +{hiddenTagCount}
          </Badge>
        )}
      </div>

      {/* Updated */}
      <span className="w-20 shrink-0 text-[12px] text-[var(--text-tertiary)] text-right">
        {formatDate(bin.updated_at)}
      </span>
    </BaseTableRow>
  );
}, (prev, next) => {
  return areCommonBinCardPropsEqual(prev, next);
});
