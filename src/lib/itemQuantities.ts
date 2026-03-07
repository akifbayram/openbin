import type { AiSuggestedItem } from '@/types';

/** Extract a name→quantity map from AI-suggested items, omitting items without a quantity. */
export function buildQuantityMap(items: AiSuggestedItem[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const i of items) { if (i.quantity) map[i.name] = i.quantity; }
  return map;
}

/** Merge a string[] items list with a name→quantity map into the API submission format. */
export function mergeItemQuantities(
  items: string[],
  quantities: Record<string, number>,
): (string | { name: string; quantity: number })[] {
  return items.map((name) => {
    const qty = quantities[name];
    return qty ? { name, quantity: qty } : name;
  });
}
