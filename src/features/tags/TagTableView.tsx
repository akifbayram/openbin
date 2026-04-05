import { ArrowUpFromLine, ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
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
  tagParents: Map<string, string>;
  getTagBadgeStyle: (tag: string) => React.CSSProperties | undefined;
  onColorChange: (tag: string, color: string) => void;
  onRename?: (tag: string) => void;
  onDelete?: (tag: string) => void;
  onSetParent?: (tag: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

const menuItemClass = 'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer outline-none focus-visible:bg-[var(--bg-hover)]';

function TagRowMenu({
  tag,
  hasChildren,
  onRename,
  onDelete,
  onSetParent,
}: {
  tag: string;
  hasChildren: boolean;
  onRename: () => void;
  onDelete: () => void;
  onSetParent?: (tag: string) => void;
}) {
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
          'absolute right-0 top-full mt-1 z-50 w-44 rounded-[var(--radius-md)] flat-popover overflow-hidden',
        )}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close(); onRename(); }}
            className={menuItemClass}
          >
            <Pencil className="h-4 w-4 text-[var(--text-tertiary)]" />
            Rename
          </button>
          {onSetParent && !hasChildren && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); close(); onSetParent(tag); }}
              className={menuItemClass}
            >
              <ArrowUpFromLine className="h-4 w-4 text-[var(--text-tertiary)]" />
              Set Parent...
            </button>
          )}
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
  tagParents,
  getTagBadgeStyle,
  onColorChange,
  onRename,
  onDelete,
  onSetParent,
  hasMore,
  isLoadingMore,
  loadMore,
}: TagTableViewProps) {
  const navigate = useNavigate();
  const t = useTerminology();

  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('openbin-tag-tree-collapsed');
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  });

  function toggleCollapse(parent: string) {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parent)) next.delete(parent); else next.add(parent);
      localStorage.setItem('openbin-tag-tree-collapsed', JSON.stringify([...next]));
      return next;
    });
  }

  // Identify parent tags (tags that have children)
  const parentSet = useMemo(() => {
    const set = new Set<string>();
    for (const [, parent] of tagParents) set.add(parent);
    return set;
  }, [tagParents]);

  // Build tree-ordered tag list
  const orderedTags = useMemo(() => {
    const childrenByParent = new Map<string, TagEntry[]>();

    for (const tag of tags) {
      const parent = tagParents.get(tag.tag);
      if (parent) {
        const list = childrenByParent.get(parent) || [];
        list.push(tag);
        childrenByParent.set(parent, list);
      }
    }

    const finalResult: Array<TagEntry & { isChild: boolean; isParent: boolean }> = [];
    const processedParents = new Set<string>();

    for (const tag of tags) {
      if (tagParents.get(tag.tag)) continue; // Skip children — added under parents
      if (parentSet.has(tag.tag)) {
        if (processedParents.has(tag.tag)) continue;
        processedParents.add(tag.tag);
        finalResult.push({ ...tag, isChild: false, isParent: true });
        if (!collapsedParents.has(tag.tag)) {
          const children = childrenByParent.get(tag.tag) || [];
          for (const child of children) {
            finalResult.push({ ...child, isChild: true, isParent: false });
          }
        }
      } else {
        finalResult.push({ ...tag, isChild: false, isParent: false });
      }
    }

    return finalResult;
  }, [tags, tagParents, parentSet, collapsedParents]);

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
        {orderedTags.map(({ tag, count, isChild, isParent }) => (
          <TableRow
            key={tag}
            tabIndex={0}
            role="button"
            aria-label={`Filter by tag: ${tag}`}
            onClick={() => navigate(`/bins?tags=${encodeURIComponent(tag)}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/bins?tags=${encodeURIComponent(tag)}`);
            }}
            className={cn(isChild && 'bg-[var(--bg-hover)]/30')}
          >
            <div className={cn('flex-[2] min-w-0', isChild && 'pl-7')}>
              <div className="flex items-center gap-1.5">
                {isParent && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(tag); }}
                    className="p-0.5 text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                    aria-label={collapsedParents.has(tag) ? `Expand ${tag}` : `Collapse ${tag}`}
                  >
                    {collapsedParents.has(tag) ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                <Badge
                  variant="secondary"
                  className="text-[13px] truncate max-w-full"
                  style={getTagBadgeStyle(tag)}
                >
                  <Highlight text={tag} query={searchQuery} />
                </Badge>
              </div>
            </div>
            <span className="w-20 shrink-0 text-[13px] text-[var(--text-tertiary)] text-right tabular-nums">
              {count} {count !== 1 ? t.bins : t.bin}
            </span>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: stops row click propagation to color picker */}
            <div role="presentation" className="w-10 shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
              <TagColorPicker
                currentColor={tagColors.get(tag) || ''}
                onColorChange={(color) => onColorChange(tag, color)}
                tagName={tag}
              />
            </div>
            {onRename && onDelete && (
              /* biome-ignore lint/a11y/noStaticElementInteractions: stops row click propagation to menu */
              <div role="presentation" className="w-10 shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
                <TagRowMenu
                  tag={tag}
                  hasChildren={parentSet.has(tag)}
                  onRename={() => onRename(tag)}
                  onDelete={() => onDelete(tag)}
                  onSetParent={onSetParent}
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
