import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { usePaginatedList } from '@/lib/usePaginatedList';

export interface TagEntry {
  tag: string;
  count: number;
}

export function usePaginatedTagList(search?: string, sort?: string, order?: 'asc' | 'desc', pageSize = 40) {
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
    if (order === 'desc') {
      params.set('sort_dir', 'desc');
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

function notifyTagsChanged() {
  notify(Events.BINS);
  notify(Events.TAG_COLORS);
}

export async function renameTag(locationId: string, oldTag: string, newTag: string): Promise<{ binsUpdated: number }> {
  const result = await apiFetch<{ binsUpdated: number }>('/api/tags/rename', {
    method: 'PUT',
    body: { locationId, oldTag, newTag },
  });
  notifyTagsChanged();
  return result;
}

export async function deleteTag(locationId: string, tag: string): Promise<{ binsUpdated: number }> {
  const result = await apiFetch<{ binsUpdated: number }>(
    `/api/tags/${encodeURIComponent(tag)}?location_id=${encodeURIComponent(locationId)}`,
    { method: 'DELETE' },
  );
  notifyTagsChanged();
  return result;
}
