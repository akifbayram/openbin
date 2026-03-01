import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AiProvider, AiSettings } from '@/types';

export function useAiSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function handleChange() {
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener('ai-settings-changed', handleChange);
    return () => window.removeEventListener('ai-settings-changed', handleChange);
  }, []);

  useEffect(() => {
    if (!token) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<AiSettings | null>('/api/ai/settings')
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, refreshKey]);

  return { settings, isLoading, setSettings };
}

export function notifyAiSettingsChanged() {
  window.dispatchEvent(new Event('ai-settings-changed'));
}

export async function saveAiSettings(opts: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  endpointUrl?: string;
  customPrompt?: string | null;
  commandPrompt?: string | null;
  queryPrompt?: string | null;
  structurePrompt?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  requestTimeout?: number | null;
}): Promise<AiSettings> {
  const result = await apiFetch<AiSettings>('/api/ai/settings', {
    method: 'PUT',
    body: opts,
  });
  notifyAiSettingsChanged();
  return result;
}

export async function deleteAiSettings(): Promise<void> {
  await apiFetch('/api/ai/settings', { method: 'DELETE' });
  notifyAiSettingsChanged();
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
