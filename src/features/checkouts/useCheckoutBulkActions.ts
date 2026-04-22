import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Events, notify } from '@/lib/eventBus';
import { pluralize } from '@/lib/utils';

type ToastFn = (toast: { message: string; variant?: 'error' | 'success' }) => void;

export function useCheckoutBulkActions(
  locationId: string | null,
  clearSelection: () => void,
  showToast: ToastFn,
) {
  const [isBusy, setIsBusy] = useState(false);

  const call = useCallback(
    async (
      checkoutIds: string[],
      targetBinId: string | undefined,
      targetName: string | undefined,
    ) => {
      if (!locationId) return;
      setIsBusy(true);
      try {
        const body: Record<string, unknown> = { checkoutIds };
        if (targetBinId) body.targetBinId = targetBinId;
        const { returned, errors } = await apiFetch<{
          returned: number;
          errors: Array<{ id: string; reason: string }>;
        }>(`/api/locations/${encodeURIComponent(locationId)}/checkouts/bulk-return`, {
          method: 'POST',
          body,
        });
        notify(Events.CHECKOUTS);
        notify(Events.BINS);
        clearSelection();
        const main = `Returned ${pluralize(returned, 'item')}${targetName ? ` to ${targetName}` : ''}`;
        const tail = errors.length > 0 ? `. ${pluralize(errors.length, 'failed', 'failed')}.` : '';
        showToast({ message: `${main}${tail}` });
      } finally {
        setIsBusy(false);
      }
    },
    [locationId, clearSelection, showToast],
  );

  const bulkReturn = useCallback(
    (checkoutIds: string[]) => call(checkoutIds, undefined, undefined),
    [call],
  );
  const bulkReturnToBin = useCallback(
    (checkoutIds: string[], targetBinId: string, targetBinName: string) =>
      call(checkoutIds, targetBinId, targetBinName),
    [call],
  );

  return { bulkReturn, bulkReturnToBin, isBusy };
}
