import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ApiKey, ListResponse } from '@/types';

export function useApiKeys() {
  const { token } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function handleChange() {
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener('api-keys-changed', handleChange);
    return () => window.removeEventListener('api-keys-changed', handleChange);
  }, []);

  useEffect(() => {
    if (!token) {
      setKeys([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<ListResponse<ApiKey>>('/api/api-keys')
      .then((data) => {
        if (!cancelled) setKeys(data.results);
      })
      .catch(() => {
        if (!cancelled) setKeys([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, refreshKey]);

  return { keys, isLoading };
}

function notifyApiKeysChanged() {
  window.dispatchEvent(new Event('api-keys-changed'));
}

export async function createApiKey(name: string): Promise<{ id: string; key: string; keyPrefix: string; name: string }> {
  const result = await apiFetch<{ id: string; key: string; keyPrefix: string; name: string }>('/api/api-keys', {
    method: 'POST',
    body: { name },
  });
  notifyApiKeysChanged();
  return result;
}

export async function revokeApiKey(id: string): Promise<void> {
  await apiFetch(`/api/api-keys/${id}`, { method: 'DELETE' });
  notifyApiKeysChanged();
}
