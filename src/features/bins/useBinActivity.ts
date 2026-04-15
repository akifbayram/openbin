import { useAuth } from '@/lib/auth';
import { Events } from '@/lib/eventBus';
import { usePaginatedList } from '@/lib/usePaginatedList';
import type { ActivityLogEntry } from '@/types';

const REFRESH_EVENTS = [Events.BINS, Events.PHOTOS, Events.ATTACHMENTS, Events.CHECKOUTS];

export function useBinActivity(binId: string | undefined, pageSize = 20) {
  const { activeLocationId } = useAuth();
  const basePath =
    activeLocationId && binId
      ? `/api/locations/${encodeURIComponent(activeLocationId)}/activity?entity_type=bin&entity_id=${encodeURIComponent(binId)}`
      : null;

  const { items, totalCount, isLoading, isLoadingMore, hasMore, error, loadMore } =
    usePaginatedList<ActivityLogEntry>(basePath, REFRESH_EVENTS, pageSize);

  return { entries: items, totalCount, isLoading, isLoadingMore, hasMore, error, loadMore };
}
