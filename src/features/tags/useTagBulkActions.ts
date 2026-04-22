import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Events, notify } from '@/lib/eventBus';
import { pluralize } from '@/lib/utils';

type ToastFn = (toast: { message: string; variant?: 'error' | 'success' }) => void;

export function useTagBulkActions(locationId: string | null, clearSelection: () => void, showToast: ToastFn) {
  const [isBusy, setIsBusy] = useState(false);

  function notifyTagsChanged() {
    notify(Events.BINS);
    notify(Events.TAG_COLORS);
  }

  const bulkDelete = useCallback(
    async (tags: string[]) => {
      if (!locationId) return;
      setIsBusy(true);
      try {
        const { tagsDeleted, binsUpdated } = await apiFetch<{ tagsDeleted: number; binsUpdated: number; orphanedChildren: number }>(
          '/api/tags/bulk-delete',
          { method: 'POST', body: { locationId, tags } },
        );
        notifyTagsChanged();
        clearSelection();
        showToast({ message: `Deleted ${pluralize(tagsDeleted, 'tag')} from ${pluralize(binsUpdated, 'bin')}` });
      } finally {
        setIsBusy(false);
      }
    },
    [locationId, clearSelection, showToast],
  );

  const bulkSetParent = useCallback(
    async (tags: string[], parentTag: string | null) => {
      if (!locationId) return;
      setIsBusy(true);
      try {
        const { tagsUpdated } = await apiFetch<{ tagsUpdated: number }>(
          '/api/tags/bulk-set-parent',
          { method: 'POST', body: { locationId, tags, parentTag } },
        );
        notifyTagsChanged();
        clearSelection();
        const verb = parentTag ? 'Set parent' : 'Cleared parent';
        showToast({ message: `${verb} for ${pluralize(tagsUpdated, 'tag')}` });
      } finally {
        setIsBusy(false);
      }
    },
    [locationId, clearSelection, showToast],
  );

  const bulkSetColor = useCallback(
    async (tags: string[], color: string) => {
      if (!locationId) return;
      setIsBusy(true);
      try {
        const { tagsUpdated } = await apiFetch<{ tagsUpdated: number }>(
          '/api/tags/bulk-set-color',
          { method: 'POST', body: { locationId, tags, color } },
        );
        notifyTagsChanged();
        clearSelection();
        showToast({ message: `Set color for ${pluralize(tagsUpdated, 'tag')}` });
      } finally {
        setIsBusy(false);
      }
    },
    [locationId, clearSelection, showToast],
  );

  const bulkMerge = useCallback(
    async (fromTags: string[], toTag: string) => {
      if (!locationId) return;
      setIsBusy(true);
      try {
        const { binsUpdated } = await apiFetch<{ tagsMerged: number; binsUpdated: number; childrenReassigned: number }>(
          '/api/tags/bulk-merge',
          { method: 'POST', body: { locationId, fromTags, toTag } },
        );
        notifyTagsChanged();
        clearSelection();
        showToast({ message: `Merged ${pluralize(fromTags.length, 'tag')} into "${toTag}" across ${pluralize(binsUpdated, 'bin')}` });
      } finally {
        setIsBusy(false);
      }
    },
    [locationId, clearSelection, showToast],
  );

  return { bulkDelete, bulkSetParent, bulkSetColor, bulkMerge, isBusy };
}
