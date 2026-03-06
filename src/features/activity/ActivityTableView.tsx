import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
import { formatTimeAgo } from '@/lib/formatTime';
import { useTerminology } from '@/lib/terminology';
import type { ActivityLogEntry } from '@/types';
import { getActionColor, getActionIcon, getActionLabel, renderChangeDiff } from './activityHelpers';

interface ActivityTableViewProps {
  entries: ActivityLogEntry[];
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

export function ActivityTableView({ entries, hasMore, isLoadingMore, loadMore }: ActivityTableViewProps) {
  const navigate = useNavigate();
  const t = useTerminology();

  return (
    <>
      <Table>
        <TableHeader>
          <span className="w-8 shrink-0" />
          <span className="flex-[2] text-[12px] font-medium text-gray-500 dark:text-gray-400">Description</span>
          <span className="hidden md:block flex-1 text-[12px] font-medium text-gray-500 dark:text-gray-400">User</span>
          <span className="hidden lg:block w-24 text-[12px] font-medium text-gray-500 dark:text-gray-400">Type</span>
          <span className="w-24 shrink-0 text-[12px] font-medium text-gray-500 dark:text-gray-400 text-right">Time</span>
        </TableHeader>

        {entries.map((entry) => {
          const isClickable =
            entry.entity_type === 'bin' &&
            entry.entity_id &&
            entry.action !== 'permanent_delete' &&
            entry.action !== 'delete';
          const changeDiffs = renderChangeDiff(entry);

          return (
            <TableRow
              key={entry.id}
              tabIndex={isClickable ? 0 : undefined}
              role={isClickable ? 'button' : undefined}
              className={isClickable ? undefined : 'cursor-default [@media(hover:hover)]:hover:bg-transparent'}
              onClick={() => {
                if (isClickable) {
                  navigate(`/bin/${entry.entity_id}`, { state: { backLabel: 'Activity', backPath: '/activity' } });
                }
              }}
              onKeyDown={(e) => {
                if (isClickable && e.key === 'Enter') {
                  navigate(`/bin/${entry.entity_id}`, { state: { backLabel: 'Activity', backPath: '/activity' } });
                }
              }}
            >
              {/* Icon */}
              <div className="w-8 shrink-0 flex justify-center">
                <div
                  className={`h-6 w-6 rounded-full bg-white/70 dark:bg-gray-800/70 flex items-center justify-center ${getActionColor(entry.action)}`}
                >
                  {getActionIcon(entry)}
                </div>
              </div>

              {/* Description */}
              <div className="flex-[2] min-w-0">
                <p className="text-[13px] truncate">
                  <span className="md:hidden font-medium">{entry.display_name} </span>
                  {getActionLabel(entry, t)}
                </p>
                {changeDiffs && (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                    {changeDiffs.map((d, i) => (
                      <span key={d.field}>
                        {i > 0 && ', '}
                        {d.field}: <span className="line-through">{d.old}</span> → {d.new}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              {/* User */}
              <div className="hidden md:flex flex-1 min-w-0 items-center gap-1.5">
                <span className="text-[13px] text-gray-600 dark:text-gray-300 truncate">{entry.display_name}</span>
                {entry.auth_method === 'api_key' && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                    API{entry.api_key_name ? `: ${entry.api_key_name}` : ''}
                  </Badge>
                )}
              </div>

              {/* Type */}
              <div className="hidden lg:block w-24 shrink-0">
                <Badge variant="outline" className="text-[11px] capitalize">
                  {entry.entity_type}
                </Badge>
              </div>

              {/* Time */}
              <span className="w-24 shrink-0 text-[12px] text-gray-500 dark:text-gray-400 text-right">
                {formatTimeAgo(entry.created_at)}
              </span>
            </TableRow>
          );
        })}
      </Table>
      <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
    </>
  );
}
