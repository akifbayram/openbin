import { useAuth } from '@/lib/auth';
import { usePaginatedList } from '@/lib/usePaginatedList';
import type { ActivityLogEntry } from '@/types';
import type { EntityTypeFilter } from './activityHelpers';

export function usePaginatedActivityLog(entityTypeFilter?: EntityTypeFilter, pageSize = 50) {
  const { activeLocationId } = useAuth();

  let basePath: string | null = null;
  if (activeLocationId) {
    basePath = `/api/locations/${encodeURIComponent(activeLocationId)}/activity`;
    if (entityTypeFilter) {
      basePath += `?entity_type=${encodeURIComponent(entityTypeFilter)}`;
    }
  }

  const { items, totalCount, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedList<ActivityLogEntry>(
    basePath,
    [],
    pageSize,
  );

  return { entries: items, totalCount, isLoading, isLoadingMore, hasMore, loadMore };
}
