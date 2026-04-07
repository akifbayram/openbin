import { useAuth } from '@/lib/auth';
import { usePaginatedList } from '@/lib/usePaginatedList';
import type { ActivityLogEntry } from '@/types';
import type { EntityTypeFilter } from './activityHelpers';

export function usePaginatedActivityLog(
  entityTypeFilter?: EntityTypeFilter,
  userId?: string,
  dateFrom?: string,
  dateTo?: string,
  pageSize = 50,
) {
  const { activeLocationId } = useAuth();

  let basePath: string | null = null;
  if (activeLocationId) {
    const params = new URLSearchParams();
    if (entityTypeFilter) params.set('entity_type', entityTypeFilter);
    if (userId) params.set('user_id', userId);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    const qs = params.toString();
    basePath = `/api/locations/${encodeURIComponent(activeLocationId)}/activity${qs ? `?${qs}` : ''}`;
  }

  const { items, totalCount, isLoading, isLoadingMore, hasMore, error, loadMore } = usePaginatedList<ActivityLogEntry>(
    basePath,
    [],
    pageSize,
  );

  return { entries: items, totalCount, isLoading, isLoadingMore, hasMore, error, loadMore };
}
