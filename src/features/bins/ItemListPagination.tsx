import { OptionGroup, type OptionGroupOption } from '@/components/ui/option-group';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import type { PageSizeValue } from './useItemPageSize';

interface ItemListPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: PageSizeValue;
  pageSizeOptions: PageSizeValue[];
  onPageChange: (p: number) => void;
  onPageSizeChange: (v: PageSizeValue) => void;
  /** Smallest count at which the size picker is shown. Default = 10 (smallest numeric option). */
  minCountToShowSizePicker?: number;
  itemLabel?: string;
}

type SizeKey = `${Exclude<PageSizeValue, 'all'>}` | 'all';

function toKey(v: PageSizeValue): SizeKey {
  return v === 'all' ? 'all' : (String(v) as SizeKey);
}

function fromKey(k: SizeKey): PageSizeValue {
  return k === 'all' ? 'all' : (Number(k) as PageSizeValue);
}

export function ItemListPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  minCountToShowSizePicker = 10,
  itemLabel = 'items',
}: ItemListPaginationProps) {
  const showPager = totalPages > 1 && pageSize !== 'all';
  const showSizePicker = totalCount >= minCountToShowSizePicker;

  if (!showPager && !showSizePicker) return null;

  const sizeOptions: OptionGroupOption<SizeKey>[] = pageSizeOptions.map((v) => ({
    key: toKey(v),
    label: v === 'all' ? 'All' : String(v),
  }));

  return (
    <div className="border-t border-[var(--border-subtle)]">
      {showPager && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalCount={totalCount}
          pageSize={typeof pageSize === 'number' ? pageSize : 1}
          itemLabel={itemLabel}
        />
      )}
      {showSizePicker && (
        <div className={cn('px-3.5', showPager ? 'pb-3' : 'py-3')}>
          <OptionGroup
            options={sizeOptions}
            value={toKey(pageSize)}
            onChange={(k) => onPageSizeChange(fromKey(k))}
            size="sm"
            aria-label="Items per page"
          />
        </div>
      )}
    </div>
  );
}
