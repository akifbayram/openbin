import { Box, Flex, Text } from '@chakra-ui/react';
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { type CSSProperties, useRef } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';

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

const pageSizeBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  paddingInline: '8px',
  paddingBlock: '2px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '12px',
  color: 'var(--text-medium)',
  transition: 'background-color 0.15s',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
};

function PageSizeSelect({ value, options, onChange }: { value: number; options: number[]; onChange: (size: number) => void }) {
  const { visible, animating, close, toggle } = usePopover();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close);

  return (
    <Box position="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        style={pageSizeBtnStyle}
        aria-haspopup="listbox"
        aria-expanded={visible}
      >
        {value} per page
        <ChevronsUpDown className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
      </button>
      {visible && (
        <Box
          role="listbox"
          className={animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'}
          position="absolute"
          bottom="full"
          mb="1.5"
          right="0"
          zIndex={50}
          borderRadius="var(--radius-md)"
          py="1"
          boxShadow="lg"
          border="1px solid var(--border-glass)"
          minW="100px"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              onClick={() => { onChange(opt); close(); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingInline: '12px',
                paddingBlock: '6px',
                fontSize: '12px',
                transition: 'background-color 0.15s',
                background: opt === value ? 'var(--bg-hover)' : undefined,
                color: opt === value ? undefined : 'var(--text-medium)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Check
                className="h-3 w-3 shrink-0"
                style={{
                  color: opt === value ? 'var(--accent-fg)' : undefined,
                  visibility: opt === value ? 'visible' : 'hidden',
                }}
              />
              {opt}
            </button>
          ))}
        </Box>
      )}
    </Box>
  );
}

const navBtnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '36px',
  width: '36px',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  transition: 'background-color 0.15s, color 0.15s',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
};

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
  const rangeEnd = showSummary ? Math.min(currentPage * pageSize, totalCount as number) : 0;
  const showFooter = showSummary || (pageSizeOptions && onPageSizeChange);

  if (!showNav && !showFooter) return null;

  return (
    <Box as="nav" aria-label="Pagination" display="flex" flexDirection="column" alignItems="center" gap="2" pt="4" pb="2">
      {showNav && (
        <Flex align="center" gap="1">
          {/* Previous */}
          <Tooltip content="Previous page">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              style={{
                ...navBtnBase,
                color: currentPage <= 1 ? 'var(--text-tertiary)' : 'var(--text-medium)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.4 : undefined,
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </Tooltip>

          {/* Page numbers — full on md+, simplified on mobile */}
          <Flex display={{ base: 'none', sm: 'flex' }} align="center" gap="1">
            {pages.map((p, idx) =>
              p === 'ellipsis' ? (
                <Flex
                  key={`ellipsis${idx === 1 ? 'start' : 'end'}`}
                  align="center"
                  justify="center"
                  h="9"
                  w="9"
                  fontSize="sm"
                  color="var(--text-tertiary)"
                >
                  &hellip;
                </Flex>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={p === currentPage ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '36px',
                    minWidth: '36px',
                    paddingInline: '8px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontWeight: p === currentPage ? 600 : 500,
                    transition: 'background-color 0.15s, color 0.15s',
                    background: p === currentPage ? 'var(--bg-indicator)' : undefined,
                    boxShadow: p === currentPage ? '0 1px 2px rgba(0,0,0,0.05)' : undefined,
                    color: p === currentPage ? undefined : 'var(--text-medium)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ),
            )}
          </Flex>

          {/* Mobile: page X of Y */}
          <Flex display={{ base: 'flex', sm: 'none' }} align="center" px="3" fontSize="sm" color="var(--text-medium)">
            {currentPage} / {totalPages}
          </Flex>

          {/* Next */}
          <Tooltip content="Next page">
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              style={{
                ...navBtnBase,
                color: currentPage >= totalPages ? 'var(--text-tertiary)' : 'var(--text-medium)',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.4 : undefined,
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </Tooltip>
        </Flex>
      )}

      {/* Summary + page size */}
      {showFooter && (
        <Flex align="center" gap="3" fontSize="xs" color="var(--text-tertiary)">
          {showSummary && (
            <Text as="span">
              Showing {rangeStart}&ndash;{rangeEnd} of {totalCount} {itemLabel}
            </Text>
          )}
          {pageSizeOptions && onPageSizeChange && pageSize != null && (
            <PageSizeSelect value={pageSize} options={pageSizeOptions} onChange={onPageSizeChange} />
          )}
        </Flex>
      )}
    </Box>
  );
}
