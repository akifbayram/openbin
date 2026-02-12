import { useState, useEffect } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AiSettings, AiProvider } from '@/types';

export function useAiSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<AiSettings>('/api/ai/settings')
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((err) => {
        if (!cancelled) {
          // 404 means not configured — that's fine
          if (err instanceof ApiError && err.status === 404) {
            setSettings(null);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token]);

  return { settings, isLoading, setSettings };
}

export async function saveAiSettings(opts: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  endpointUrl?: string;
}): Promise<AiSettings> {
  return apiFetch<AiSettings>('/api/ai/settings', {
    method: 'PUT',
    body: opts,
  });
}

export async function deleteAiSettings(): Promise<void> {
  await apiFetch('/api/ai/settings', { method: 'DELETE' });
}

export async function testAiConnection(opts: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  endpointUrl?: string;
}): Promise<void> {
  await apiFetch('/api/ai/test', {
    method: 'POST',
    body: opts,
  });
}
