import { Check, Lock } from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Highlight } from '@/components/ui/highlight';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { TableRow as BaseTableRow, Table, TableHeader } from '@/components/ui/table';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { resolveColor } from '@/lib/colorPalette';
import { formatDate } from '@/lib/formatTime';
import { resolveIcon } from '@/lib/iconMap';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { areCommonBinCardPropsEqual } from './binMemoUtils';
import { useBinCardInteraction } from './useBinCardInteraction';
import type { SortOption } from './useBins';
import type { FieldKey } from './useColumnVisibility';

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
  onSelectAll?: () => void;
  isVisible?: (field: FieldKey) => boolean;
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
  onSelectAll,
  isVisible,
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
        {isVisible?.('area') !== false && (
          <SortHeader label="Area" column="area" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="hidden md:flex flex-1" />
        )}
        {isVisible?.('items') !== false && (
          <span className="hidden lg:block flex-[1.5] text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Items</span>
        )}
        {isVisible?.('tags') !== false && (
          <span className="hidden sm:block flex-1 text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Tags</span>
        )}
        {isVisible?.('notes') && (
          <span className="hidden lg:block flex-1 text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Notes</span>
        )}
        {isVisible?.('createdBy') && (
          <span className="hidden md:block w-24 text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Created By</span>
        )}
        {isVisible?.('created') && (
          <SortHeader label="Created" column="created" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} defaultDirection="desc" className="w-20 justify-end" />
        )}
        {isVisible?.('updated') !== false && (
          <SortHeader label="Updated" column="updated" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} defaultDirection="desc" className="w-20 justify-end" />
        )}
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
          isVisible={isVisible}
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
  isVisible?: (field: FieldKey) => boolean;
}

const BinTableRow = React.memo(function BinTableRow({
  bin,
  index,
  selectable,
  selected,
  onSelect,
  searchQuery,
  onTagClick,
  isVisible,
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
          <button
            type="button"
            tabIndex={0}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center appearance-none bg-transparent p-0',
              selected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-tertiary)]',
            )}
            onClick={(e) => { e.stopPropagation(); onSelect(bin.id, index, e.shiftKey); }}
            aria-label="Select"
          >
            {selected && <Check className="h-2.5 w-2.5 text-white animate-check-pop" strokeWidth={3} />}
          </button>
        ) : (
          <button
            type="button"
            tabIndex={0}
            className="relative h-5 w-5 appearance-none bg-transparent border-none p-0"
            onClick={(e) => { e.stopPropagation(); onSelect(bin.id, index, e.shiftKey); }}
            aria-label="Select"
          >
            {/* Color dot + icon — fades out on hover */}
            <div className="absolute inset-0 flex items-center justify-center gap-1 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-0">
              <div className="h-4 w-4 rounded-full shrink-0" style={colorPreset ? { backgroundColor: colorPreset.dot } : { backgroundColor: 'var(--text-tertiary)' }} />
            </div>
            {/* Checkbox revealed on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100">
              <div className="h-4 w-4 rounded-full border-2 border-[var(--text-tertiary)] flex items-center justify-center" />
            </div>
          </button>
        )}
      </div>

      {/* Name (with icon) */}
      <div className="flex-[2] min-w-0 flex items-center gap-2">
        {isVisible?.('icon') !== false && (
          <BinIcon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
        )}
        <span className="truncate font-medium text-[14px] text-[var(--text-primary)]">
          <Highlight text={bin.name} query={searchQuery} />
        </span>
        {bin.visibility === 'private' && (
          <Lock className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
        )}
      </div>

      {/* Area */}
      {isVisible?.('area') !== false && (
        <div className="hidden md:block flex-1 min-w-0">
          {bin.area_name && (
            <Badge variant="outline" className="text-[11px] truncate max-w-full">
              <Highlight text={bin.area_name} query={searchQuery} />
            </Badge>
          )}
        </div>
      )}

      {/* Items */}
      {isVisible?.('items') !== false && (
        <div className="hidden lg:block flex-[1.5] min-w-0">
          {bin.items.length > 0 && (
            <span className="text-[12px] text-[var(--text-tertiary)] truncate block">
              <Highlight text={bin.items.map((i) => i.name).join(', ')} query={searchQuery} />
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {isVisible?.('tags') !== false && (
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
      )}

      {/* Notes */}
      {isVisible?.('notes') && (
        <div className="hidden lg:block flex-1 min-w-0">
          {bin.notes && (
            <span className="text-[12px] text-[var(--text-tertiary)] truncate block italic">
              {bin.notes}
            </span>
          )}
        </div>
      )}

      {/* Created By */}
      {isVisible?.('createdBy') && (
        <span className="hidden md:block w-24 shrink-0 text-[12px] text-[var(--text-tertiary)] truncate">
          {bin.created_by_name}
        </span>
      )}

      {/* Created */}
      {isVisible?.('created') && (
        <span className="w-20 shrink-0 text-[12px] text-[var(--text-tertiary)] text-right">
          {formatDate(bin.created_at)}
        </span>
      )}

      {/* Updated */}
      {isVisible?.('updated') !== false && (
        <span className="w-20 shrink-0 text-[12px] text-[var(--text-tertiary)] text-right">
          {formatDate(bin.updated_at)}
        </span>
      )}
    </BaseTableRow>
  );
}, (prev, next) => {
  return areCommonBinCardPropsEqual(prev, next);
});
