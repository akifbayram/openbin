import { Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { OptionGroup, type OptionGroupOption } from '@/components/ui/option-group';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import { ActivityTableView } from './ActivityTableView';
import { ENTITY_TYPE_FILTERS, type EntityTypeFilter } from './activityHelpers';
import { usePaginatedActivityLog } from './useActivity';

export function ActivityPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const t = useTerminology();
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityTypeFilter>('');
  const filterOptions = useMemo<OptionGroupOption<EntityTypeFilter>[]>(
    () => ENTITY_TYPE_FILTERS.map((f) => ({ key: f.value, label: f.tKey ? t[f.tKey] : f.label })),
    [t],
  );
  const { entries, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedActivityLog(entityTypeFilter, 50);

  useEffect(() => {
    if (!permissionsLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [permissionsLoading, isAdmin, navigate]);

  if (!permissionsLoading && !isAdmin) {
    return null;
  }

  return (
    <div className="page-content">
      <PageHeader title="Activity" />

      <OptionGroup
        options={filterOptions}
        value={entityTypeFilter}
        onChange={setEntityTypeFilter}
        size="sm"
      />

      <Crossfade
        isLoading={(isLoading || permissionsLoading) && entries.length === 0}
        skeleton={
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                <Skeleton key={i} className="h-7 w-16 rounded-full" />
              ))}
            </div>
            <div className="glass-card rounded-[var(--radius-lg)] overflow-hidden">
              <div className="h-9 bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]" />
              <SkeletonList count={8}>
                {() => (
                  <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                    <Skeleton className="h-4 flex-[2]" />
                    <Skeleton className="h-4 flex-1 hidden md:block" />
                    <Skeleton className="h-4 w-24 shrink-0" />
                  </div>
                )}
              </SkeletonList>
            </div>
          </div>
        }
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={entityTypeFilter ? 'No matching activity' : 'No activity yet'}
            subtitle={
              entityTypeFilter
                ? 'Try a different filter'
                : `Actions like creating, editing, and deleting ${t.bins} will appear here`
            }
          />
        ) : (
          <ActivityTableView
            entries={entries}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            loadMore={loadMore}
          />
        )}
      </Crossfade>
    </div>
  );
}
