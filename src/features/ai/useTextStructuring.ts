import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
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
  items: string[];
}

/** @deprecated Use mapAiError from aiErrors.ts instead */
export function mapStructureErrorMessage(err: unknown): string {
  return mapAiError(err, 'Couldn\'t find items — try describing them differently');
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
      setError(mapAiError(err, 'Couldn\'t extract items — try describing them differently'));
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
