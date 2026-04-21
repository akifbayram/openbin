import { Lock } from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
import { Highlight } from '@/components/ui/highlight';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { TableRow as BaseTableRow, Table, TableHeader } from '@/components/ui/table';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { cn, formatDate } from '@/lib/utils';
import type { Bin, CustomField } from '@/types';
import { areCommonBinCardPropsEqual } from './binMemoUtils';
import { useBinCardInteraction } from './useBinCardInteraction';
import type { BinFilters, SortOption } from './useBins';

interface BinTableViewProps {
  bins: Bin[];
  sortColumn: SortOption;
  sortDirection: SortDirection;
  onSortChange: (column: SortOption, direction: SortDirection) => void;
  selectable: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string, index: number, shiftKey: boolean) => void;
  searchQuery: string;
  filters?: BinFilters;
  onTagClick: (tag: string) => void;
  isVisible?: (field: string) => boolean;
  customFields?: CustomField[];
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
  filters,
  onTagClick,
  isVisible,
  customFields,
}: BinTableViewProps) {
  const sortedCustomFields = React.useMemo(
    () => customFields ? [...customFields].sort((a, b) => a.position - b.position) : [],
    [customFields],
  );

  return (
    <Table>
      {/* Header */}
      <TableHeader>
        <div className="flex-[2] flex items-center gap-2">
          <SortHeader label="Name" column="name" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="flex-1" />
        </div>
        {isVisible?.('area') !== false && (
          <SortHeader label="Area" column="area" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="hidden md:flex flex-1" />
        )}
        {isVisible?.('items') !== false && (
          <span className="hidden lg:block flex-[1.5] ui-col-header">Items</span>
        )}
        {isVisible?.('tags') !== false && (
          <span className="hidden sm:block flex-1 ui-col-header">Tags</span>
        )}
        {isVisible?.('notes') && (
          <span className="hidden lg:block flex-1 ui-col-header">Notes</span>
        )}
        {sortedCustomFields.map((field) =>
          isVisible?.(`cf_${field.id}`) && (
            <span key={field.id} className="hidden lg:block flex-1 min-w-0 ui-col-header truncate">
              {field.name}
            </span>
          ),
        )}
        {isVisible?.('createdBy') && (
          <span className="hidden md:block w-24 ui-col-header">Created By</span>
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
          sort={sortColumn}
          filters={filters}
          onTagClick={onTagClick}
          isVisible={isVisible}
          customFields={sortedCustomFields}
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
  sort?: SortOption;
  filters?: BinFilters;
  onTagClick: (tag: string) => void;
  isVisible?: (field: string) => boolean;
  customFields: CustomField[];
}

const BinTableRow = React.memo(function BinTableRow({
  bin,
  index,
  selectable,
  selected,
  onSelect,
  searchQuery,
  sort,
  filters,
  onTagClick,
  isVisible,
  customFields,
}: BinTableRowProps) {
  const getTagStyle = useTagStyle();
  const BinIcon = resolveIcon(bin.icon);
  const colorPreset = resolveColor(bin.color);

  const { handleClick, handleKeyDown, longPress } = useBinCardInteraction({ binId: bin.id, index, selectable, onSelect, searchQuery, sort, filters });

  const displayedTags = bin.tags.slice(0, 2);
  const hiddenTagCount = bin.tags.length - displayedTags.length;

  return (
    <BaseTableRow
      tabIndex={0}
      role="button"
      aria-label={bin.name}
      aria-selected={selectable ? selected : undefined}
      className={cn('select-none group', selected && 'bg-[var(--bg-active)]')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onContextMenu={longPress.onContextMenu}
    >
      {/* Name (with icon as selection toggle) */}
      <div className="flex-[2] min-w-0 row">
        {(isVisible?.('icon') !== false || selectable) && (
          <button
            type="button"
            tabIndex={-1}
            className="shrink-0 appearance-none bg-transparent p-0 border-none"
            onClick={(e) => { e.stopPropagation(); onSelect(bin.id, index, e.shiftKey); }}
            aria-label="Select"
          >
            <BinIconBadge icon={BinIcon} colorPreset={colorPreset} selected={selectable ? selected : undefined} />
          </button>
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

      {/* Custom Fields — one column per field definition */}
      {customFields.map((field) =>
        isVisible?.(`cf_${field.id}`) && (
          <div key={field.id} className="hidden lg:block flex-1 min-w-0">
            {bin.custom_fields?.[field.id] && (
              <span className="text-[12px] text-[var(--text-tertiary)] truncate block">
                {bin.custom_fields[field.id]}
              </span>
            )}
          </div>
        ),
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
  return (
    areCommonBinCardPropsEqual(prev, next) &&
    prev.sort === next.sort &&
    prev.filters === next.filters &&
    prev.customFields === next.customFields
  );
});
