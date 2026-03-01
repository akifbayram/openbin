import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface DefaultPrompts {
  analysis: string;
  command: string;
  query: string;
  structure: string;
}

let cached: DefaultPrompts | null = null;

export function useDefaultPrompts(): { prompts: DefaultPrompts | null; isLoading: boolean } {
  const [prompts, setPrompts] = useState<DefaultPrompts | null>(cached);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;

    apiFetch<DefaultPrompts>('/api/ai/default-prompts')
      .then((data) => {
        if (cancelled) return;
        cached = data;
        setPrompts(data);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { prompts, isLoading };
}
