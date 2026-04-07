import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify, useRefreshOn } from '@/lib/eventBus';
import type { ItemCheckout, ItemCheckoutWithContext, ListResponse } from '@/types';

export function useCheckouts(binId: string | undefined) {
  const { token } = useAuth();
  const [checkouts, setCheckouts] = useState<ItemCheckout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshCounter = useRefreshOn(Events.CHECKOUTS);
  const loadedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!binId || !token) {
      setCheckouts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    if (loadedRef.current !== binId) setIsLoading(true);

    apiFetch<ListResponse<ItemCheckout>>(`/api/bins/${binId}/checkouts`)
      .then((data) => {
        if (!cancelled) {
          setCheckouts(data.results);
          loadedRef.current = binId;
        }
      })
      .catch(() => {
        if (!cancelled) setCheckouts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [binId, token, refreshCounter]);

  return { checkouts, isLoading };
}

export function useLocationCheckouts(locationId: string | undefined) {
  const { token } = useAuth();
  const [checkouts, setCheckouts] = useState<ItemCheckoutWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshCounter = useRefreshOn(Events.CHECKOUTS);

  useEffect(() => {
    if (!locationId || !token) {
      setCheckouts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<ListResponse<ItemCheckoutWithContext>>(`/api/locations/${locationId}/checkouts`)
      .then((data) => {
        if (!cancelled) setCheckouts(data.results);
      })
      .catch(() => {
        if (!cancelled) setCheckouts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, token, refreshCounter]);

  return { checkouts, isLoading };
}

export async function checkoutItem(binId: string, itemId: string): Promise<ItemCheckout> {
  const result = await apiFetch<{ checkout: ItemCheckout }>(`/api/bins/${binId}/items/${itemId}/checkout`, {
    method: 'POST',
  });
  notify(Events.CHECKOUTS);
  notify(Events.BINS);
  return result.checkout;
}

export async function returnItem(binId: string, itemId: string, targetBinId?: string): Promise<ItemCheckout> {
  const result = await apiFetch<{ checkout: ItemCheckout }>(`/api/bins/${binId}/items/${itemId}/return`, {
    method: 'POST',
    body: targetBinId ? { targetBinId } : {},
  });
  notify(Events.CHECKOUTS);
  notify(Events.BINS);
  return result.checkout;
}
