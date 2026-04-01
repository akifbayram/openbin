import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Highlight } from '@/components/ui/highlight';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import { useTerminology } from '@/lib/terminology';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import { TagColorPicker } from './TagColorPicker';
import type { TagEntry } from './useTags';

export type TagSortColumn = 'alpha' | 'count';

interface TagTableViewProps {
  tags: TagEntry[];
  sortColumn: TagSortColumn;
  sortDirection: SortDirection;
  onSortChange: (column: TagSortColumn, direction: SortDirection) => void;
  searchQuery: string;
  tagColors: Map<string, string>;
  getTagBadgeStyle: (tag: string) => React.CSSProperties | undefined;
  onColorChange: (tag: string, color: string) => void;
  onRename?: (tag: string) => void;
  onDelete?: (tag: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

function TagRowMenu({ tag, onRename, onDelete }: { tag: string; onRename: () => void; onDelete: () => void }) {
  const { visible, animating, toggle, close } = usePopover();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close);

  return (
    <div ref={ref} className="relative">
      <Tooltip content="Tag actions">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          className="h-9 w-9 rounded-[var(--radius-lg)] flex items-center justify-center hover:bg-[var(--bg-active)] transition-colors shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
          aria-label={`Actions for tag ${tag}`}
        >
          <MoreHorizontal className="h-4 w-4 text-[var(--text-tertiary)]" />
        </button>
      </Tooltip>
      {visible && (
        <div className={cn(
          animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
          'absolute right-0 top-full mt-1 z-50 w-40 rounded-[var(--radius-md)] flat-popover overflow-hidden',
        )}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close(); onRename(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer outline-none focus-visible:bg-[var(--bg-hover)]"
          >
            <Pencil className="h-4 w-4 text-[var(--text-tertiary)]" />
            Rename
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close(); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer outline-none focus-visible:bg-[var(--bg-hover)]"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function TagTableView({
  tags,
  sortColumn,
  sortDirection,
  onSortChange,
  searchQuery,
  tagColors,
  getTagBadgeStyle,
  onColorChange,
  onRename,
  onDelete,
  hasMore,
  isLoadingMore,
  loadMore,
}: TagTableViewProps) {
  const navigate = useNavigate();
  const t = useTerminology();

  return (
    <>
      <Table>
        {/* Header */}
        <TableHeader>
          <SortHeader label="Tag" column="alpha" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} className="flex-[2]" />
          <SortHeader label="Count" column="count" currentColumn={sortColumn} currentDirection={sortDirection} onSort={onSortChange} defaultDirection="desc" className="w-20 justify-end" />
          <span className="w-10 shrink-0" />
          {onRename && onDelete && <span className="w-10 shrink-0" />}
        </TableHeader>

        {/* Rows */}
        {tags.map((entry) => (
          <TableRow
            key={entry.tag}
            tabIndex={0}
            role="button"
            aria-label={`Filter by tag: ${entry.tag}`}
            onClick={() => navigate(`/bins?tags=${encodeURIComponent(entry.tag)}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/bins?tags=${encodeURIComponent(entry.tag)}`);
            }}
          >
            <div className="flex-[2] min-w-0">
              <Badge
                variant="secondary"
                className="text-[13px] truncate max-w-full"
                style={getTagBadgeStyle(entry.tag)}
              >
                <Highlight text={entry.tag} query={searchQuery} />
              </Badge>
            </div>
            <span className="w-20 shrink-0 text-[13px] text-[var(--text-tertiary)] text-right tabular-nums">
              {entry.count} {entry.count !== 1 ? t.bins : t.bin}
            </span>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: stops row click propagation to color picker */}
            <div role="presentation" className="w-10 shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
              <TagColorPicker
                currentColor={tagColors.get(entry.tag) || ''}
                onColorChange={(color) => onColorChange(entry.tag, color)}
                tagName={entry.tag}
              />
            </div>
            {onRename && onDelete && (
              /* biome-ignore lint/a11y/noStaticElementInteractions: stops row click propagation to menu */
              <div role="presentation" className="w-10 shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
                <TagRowMenu
                  tag={entry.tag}
                  onRename={() => onRename(entry.tag)}
                  onDelete={() => onDelete(entry.tag)}
                />
              </div>
            )}
          </TableRow>
        ))}
      </Table>
      <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
    </>
  );
}
