import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPageNumbers } from '@/lib/paginationUtil';
import { cn } from '@/lib/utils';

interface ItemListPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (p: number) => void;
  itemLabel?: string;
}

/**
 * Compact in-card pagination footer for ItemList: summary left, pager right,
 * single horizontal row. The page-size preference lives in Settings → Preferences → Display.
 */
export function ItemListPagination({
  page,
  totalPages,
  totalCount,
  rangeStart,
  rangeEnd,
  onPageChange,
  itemLabel = 'items',
}: ItemListPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  const navBtn =
    'flex items-center justify-center h-7 w-7 rounded-[var(--radius-xs)] transition-colors';

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 px-3.5 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-hover)]"
    >
      <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
        {rangeStart}&ndash;{rangeEnd} of {totalCount} {itemLabel}
      </span>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={cn(
            navBtn,
            page <= 1
              ? 'text-[var(--text-tertiary)] cursor-not-allowed opacity-40'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div className="hidden sm:flex items-center gap-0.5">
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis separators have no stable identity
              <span key={`e${i}`} aria-hidden="true" className="flex items-center justify-center h-7 w-7 text-[12px] text-[var(--text-tertiary)]">
                &hellip;
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-center h-7 min-w-7 px-1.5 rounded-[var(--radius-xs)] text-[12px] font-medium tabular-nums transition-colors',
                  p === page
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-flat)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                )}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <span className="sm:hidden px-2 text-[12px] text-[var(--text-tertiary)] tabular-nums">
          <span className="sr-only">Page {page} of {totalPages}</span>
          <span aria-hidden="true">{page} / {totalPages}</span>
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={cn(
            navBtn,
            page >= totalPages
              ? 'text-[var(--text-tertiary)] cursor-not-allowed opacity-40'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
