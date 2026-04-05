import { useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import type { TagColor } from '@/types';

function notifyTagColorsChanged() {
  notify(Events.TAG_COLORS);
}

export function useTagColors() {
  const { activeLocationId, token } = useAuth();
  const { data: rawTagColors, isLoading } = useListData<TagColor>(
    token && activeLocationId
      ? `/api/tag-colors?location_id=${encodeURIComponent(activeLocationId)}`
      : null,
    [Events.TAG_COLORS],
  );

  const tagColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const tc of rawTagColors) {
      if (tc.color) map.set(tc.tag, tc.color);
    }
    return map;
  }, [rawTagColors]);

  const tagParents = useMemo(() => {
    const map = new Map<string, string>();
    for (const tc of rawTagColors) {
      if (tc.parent_tag) map.set(tc.tag, tc.parent_tag);
    }
    return map;
  }, [rawTagColors]);

  return { tagColors, tagParents, isLoading };
}

export async function setTagColor(locationId: string, tag: string, color: string): Promise<void> {
  await apiFetch('/api/tag-colors', {
    method: 'PUT',
    body: { locationId, tag, color },
  });
  notifyTagColorsChanged();
}

export async function removeTagColor(locationId: string, tag: string): Promise<void> {
  await apiFetch(`/api/tag-colors/${encodeURIComponent(tag)}?location_id=${encodeURIComponent(locationId)}`, {
    method: 'DELETE',
  });
  notifyTagColorsChanged();
}

export async function setTagParent(
  locationId: string,
  tag: string,
  parentTag: string | null,
  currentColor: string,
): Promise<void> {
  await apiFetch('/api/tag-colors', {
    method: 'PUT',
    body: { locationId, tag, color: currentColor, parentTag: parentTag || null },
  });
  notifyTagColorsChanged();
}
