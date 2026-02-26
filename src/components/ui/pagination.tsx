import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { usePopover } from '@/lib/usePopover';
import { useClickOutside } from '@/lib/useClickOutside';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount?: number;
  pageSize?: number;
  /** Label for the item type, e.g. "bins" */
  itemLabel?: string;
  /** When provided with onPageSizeChange, renders a page-size dropdown */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current <= 3) {
    // Near start: 1 2 3 4 ... last
    for (let i = 2; i <= 4; i++) pages.push(i);
    pages.push('ellipsis', total);
  } else if (current >= total - 2) {
    // Near end: 1 ... n-3 n-2 n-1 last
    pages.push('ellipsis');
    for (let i = total - 3; i <= total; i++) pages.push(i);
  } else {
    // Middle: 1 ... prev curr next ... last
    pages.push('ellipsis', current - 1, current, current + 1, 'ellipsis', total);
  }

  return pages;
}

function PageSizeSelect({ value, options, onChange }: { value: number; options: number[]; onChange: (size: number) => void }) {
  const { visible, animating, close, toggle } = usePopover();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        aria-haspopup="listbox"
        aria-expanded={visible}
      >
        {value} per page
        <ChevronsUpDown className="h-3 w-3 text-[var(--text-tertiary)]" />
      </button>
      {visible && (
        <div
          role="listbox"
          className={`${animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'} absolute bottom-full mb-1.5 right-0 z-50 glass-heavy rounded-[var(--radius-md)] py-1 shadow-lg border border-[var(--border-glass)] min-w-[100px]`}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              onClick={() => { onChange(opt); close(); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                opt === value
                  ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
              )}
            >
              <Check className={cn('h-3 w-3 shrink-0', opt === value ? 'text-[var(--accent)]' : 'invisible')} />
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  pageSize,
  itemLabel = 'items',
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages);
  const showNav = totalPages > 1;

  const showSummary = totalCount != null && pageSize != null;
  const rangeStart = showSummary ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = showSummary ? Math.min(currentPage * pageSize, totalCount!) : 0;
  const showFooter = showSummary || (pageSizeOptions && onPageSizeChange);

  if (!showNav && !showFooter) return null;

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center gap-2 pt-4 pb-2">
      {showNav && (
        <div className="flex items-center gap-1">
          {/* Previous */}
          <Tooltip content="Previous page">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-[var(--radius-md)] text-sm transition-colors',
                currentPage <= 1
                  ? 'text-[var(--text-muted)] cursor-not-allowed opacity-40'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </Tooltip>

          {/* Page numbers — full on md+, simplified on mobile */}
          <div className="hidden sm:flex items-center gap-1">
            {pages.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e${i}`} className="flex items-center justify-center h-9 w-9 text-sm text-[var(--text-muted)]">
                  &hellip;
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={p === currentPage ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-center h-9 min-w-9 px-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors',
                    p === currentPage
                      ? 'bg-[var(--bg-elevated)] dark:bg-[var(--bg-active)] shadow-sm text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
                  )}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          {/* Mobile: page X of Y */}
          <span className="flex sm:hidden items-center px-3 text-sm text-[var(--text-secondary)]">
            {currentPage} / {totalPages}
          </span>

          {/* Next */}
          <Tooltip content="Next page">
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-[var(--radius-md)] text-sm transition-colors',
                currentPage >= totalPages
                  ? 'text-[var(--text-muted)] cursor-not-allowed opacity-40'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Summary + page size */}
      {showFooter && (
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {showSummary && (
            <span>
              Showing {rangeStart}&ndash;{rangeEnd} of {totalCount} {itemLabel}
            </span>
          )}
          {pageSizeOptions && onPageSizeChange && pageSize != null && (
            <PageSizeSelect value={pageSize} options={pageSizeOptions} onChange={onPageSizeChange} />
          )}
        </div>
      )}
    </nav>
  );
}
