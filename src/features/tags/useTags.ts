import { useAuth } from '@/lib/auth';
import { usePaginatedList } from '@/lib/usePaginatedList';
import { Events } from '@/lib/eventBus';

export interface TagEntry {
  tag: string;
  count: number;
}

export function usePaginatedTagList(search?: string, pageSize = 40) {
  const { activeLocationId } = useAuth();

  let basePath: string | null = null;
  if (activeLocationId) {
    const params = new URLSearchParams({ location_id: activeLocationId });
    if (search?.trim()) {
      params.set('q', search.trim());
    }
    basePath = `/api/tags?${params.toString()}`;
  }

  const result = usePaginatedList<TagEntry>(basePath, [Events.BINS, Events.TAG_COLORS], pageSize);

  return {
    tags: result.items,
    totalCount: result.totalCount,
    isLoading: result.isLoading,
    isLoadingMore: result.isLoadingMore,
    hasMore: result.hasMore,
    loadMore: result.loadMore,
  };
}
