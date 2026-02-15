import { useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';

interface StructureTextOptions {
  text: string;
  mode?: 'items';
  context?: {
    binName?: string;
    existingItems?: string[];
  };
  locationId?: string;
}

interface StructureTextResult {
  items: string[];
}

export function mapStructureErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 422: return 'Check your API key and model name';
      case 429: return 'Rate limited — try again in a moment';
      case 502: return 'AI provider error — check your settings';
      default: return err.message;
    }
  }
  return 'Failed to structure text';
}

export async function structureTextItems(options: StructureTextOptions): Promise<string[]> {
  const result = await apiFetch<StructureTextResult>('/api/ai/structure-text', {
    method: 'POST',
    body: {
      text: options.text,
      mode: options.mode || 'items',
      context: options.context,
      locationId: options.locationId,
    },
  });
  return result.items;
}

export function useTextStructuring() {
  const [structuredItems, setStructuredItems] = useState<string[] | null>(null);
  const [isStructuring, setIsStructuring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const structure = useCallback(async (options: StructureTextOptions) => {
    setIsStructuring(true);
    setError(null);
    setStructuredItems(null);
    try {
      const items = await structureTextItems(options);
      setStructuredItems(items);
      return items;
    } catch (err) {
      setError(mapStructureErrorMessage(err));
      return null;
    } finally {
      setIsStructuring(false);
    }
  }, []);

  const clearStructured = useCallback(() => {
    setStructuredItems(null);
    setError(null);
  }, []);

  return { structuredItems, isStructuring, error, structure, clearStructured };
}
