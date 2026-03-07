import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AiSuggestedItem } from '@/types';
import { mapAiError } from './aiErrors';

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
  items: AiSuggestedItem[];
}

/** @deprecated Use mapAiError from aiErrors.ts instead */
export function mapStructureErrorMessage(err: unknown): string {
  return mapAiError(err, 'Couldn\'t find items — try describing them differently');
}

export async function structureTextItems(options: StructureTextOptions): Promise<AiSuggestedItem[]> {
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
  const [structuredItems, setAiSuggestedItems] = useState<AiSuggestedItem[] | null>(null);
  const [isStructuring, setIsStructuring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const structure = useCallback(async (options: StructureTextOptions) => {
    setIsStructuring(true);
    setError(null);
    setAiSuggestedItems(null);
    try {
      const items = await structureTextItems(options);
      setAiSuggestedItems(items);
      return items;
    } catch (err) {
      setError(mapAiError(err, 'Couldn\'t extract items — try describing them differently'));
      return null;
    } finally {
      setIsStructuring(false);
    }
  }, []);

  const clearStructured = useCallback(() => {
    setAiSuggestedItems(null);
    setError(null);
  }, []);

  return { structuredItems, isStructuring, error, structure, clearStructured };
}
