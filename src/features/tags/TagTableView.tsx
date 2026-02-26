import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Highlight } from '@/components/ui/highlight';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { SortHeader, type SortDirection } from '@/components/ui/sort-header';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { useTerminology } from '@/lib/terminology';
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
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
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
        </TableHeader>

        {/* Rows */}
        {tags.map((entry) => (
          <TableRow
            key={entry.tag}
            tabIndex={0}
            role="button"
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
            <span className="w-20 shrink-0 text-[13px] text-[var(--text-tertiary)] text-right">
              {entry.count} {entry.count !== 1 ? t.bins : t.bin}
            </span>
            <div className="w-10 shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
              <TagColorPicker
                currentColor={tagColors.get(entry.tag) || ''}
                onColorChange={(color) => onColorChange(entry.tag, color)}
              />
            </div>
          </TableRow>
        ))}
      </Table>
      <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
    </>
  );
}
