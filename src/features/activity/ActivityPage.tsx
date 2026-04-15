import { AlertTriangle, Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { SettingsPageHeader } from '@/features/settings/SettingsPageHeader';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import { ActivityFilterBar } from './ActivityFilterBar';
import { ActivityTableSkeleton } from './ActivityTableSkeleton';
import { ActivityTableView } from './ActivityTableView';
import type { EntityTypeFilter } from './activityHelpers';
import { getActionLabel } from './activityHelpers';
import { usePaginatedActivityLog } from './useActivity';

export function ActivityPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const t = useTerminology();

  // Filter state
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityTypeFilter>('');
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Server-side filtered data
  const { entries, isLoading, isLoadingMore, hasMore, error, loadMore } = usePaginatedActivityLog(
    entityTypeFilter,
    userId || undefined,
    dateFrom || undefined,
    dateTo || undefined,
    50,
  );

  // Client-side text search filter
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => {
      if (e.display_name.toLowerCase().includes(q)) return true;
      if (e.entity_name?.toLowerCase().includes(q)) return true;
      if (getActionLabel(e, t).toLowerCase().includes(q)) return true;
      return false;
    });
  }, [entries, searchQuery, t]);

  useEffect(() => {
    if (!permissionsLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [permissionsLoading, isAdmin, navigate]);

  if (!permissionsLoading && !isAdmin) {
    return null;
  }

  const hasFilters = entityTypeFilter || userId || dateFrom || dateTo || searchQuery;

  return (
    <>
      <SettingsPageHeader title="Activity Log" description="View changes and actions across your location." />

      <ActivityFilterBar
        entityTypeFilter={entityTypeFilter}
        onEntityTypeChange={setEntityTypeFilter}
        userId={userId}
        onUserIdChange={setUserId}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <Crossfade
        isLoading={(isLoading || permissionsLoading) && entries.length === 0}
        skeleton={<ActivityTableSkeleton count={8} withHeader />}
      >
        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load activity"
            subtitle={error}
          />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={hasFilters ? 'No matching activity' : 'No activity yet'}
            subtitle={
              hasFilters
                ? 'Try different filters or search terms'
                : `Actions like creating, editing, and deleting ${t.bins} will appear here`
            }
            variant={hasFilters ? 'search' : undefined}
          />
        ) : (
          <ActivityTableView
            entries={filteredEntries}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            loadMore={loadMore}
            searchQuery={searchQuery}
          />
        )}
      </Crossfade>
    </>
  );
}
