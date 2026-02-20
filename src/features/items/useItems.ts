import { useAuth } from '@/lib/auth';
import { usePaginatedList } from '@/lib/usePaginatedList';
import { Events } from '@/lib/eventBus';

export interface ItemEntry {
  id: string;
  name: string;
  bin_id: string;
  bin_name: string;
  bin_icon: string;
  bin_color: string;
}

export function usePaginatedItemList(search?: string, sort?: string, pageSize = 40) {
  const { activeLocationId } = useAuth();

  let basePath: string | null = null;
  if (activeLocationId) {
    const params = new URLSearchParams({ location_id: activeLocationId });
    if (search?.trim()) {
      params.set('q', search.trim());
    }
    if (sort && sort !== 'alpha') {
      params.set('sort', sort);
    }
    basePath = `/api/items?${params.toString()}`;
  }

  const result = usePaginatedList<ItemEntry>(basePath, [Events.BINS], pageSize);

  return {
    items: result.items,
    totalCount: result.totalCount,
    isLoading: result.isLoading,
    isLoadingMore: result.isLoadingMore,
    hasMore: result.hasMore,
    loadMore: result.loadMore,
  };
}
