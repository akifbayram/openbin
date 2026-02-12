import { useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { AiSuggestions } from '@/types';

function mapErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 422: return 'Check your API key and model name';
      case 429: return 'Rate limited — try again in a moment';
      case 502: return 'AI provider error — check your settings';
      default: return err.message;
    }
  }
  return 'Failed to analyze photo';
}

export function useAiAnalysis() {
  const [suggestions, setSuggestions] = useState<AiSuggestions | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (photoId: string) => {
    setIsAnalyzing(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await apiFetch<AiSuggestions>('/api/ai/analyze', {
        method: 'POST',
        body: { photoId },
      });
      setSuggestions(result);
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
    setError(null);
  }, []);

  return { suggestions, isAnalyzing, error, analyze, clearSuggestions };
}
