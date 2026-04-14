import type { AiSuggestedItem, BinItem } from '@/types';

let nextItemId = 0;

/** Generate a client-side ID for a BinItem (not persisted — server assigns real IDs). */
export function clientItemId(): string {
  return `tmp-${++nextItemId}`;
}

/** Convert BinItem[] to the API submission format. */
export function binItemsToPayload(items: BinItem[]): (string | { name: string; quantity: number })[] {
  return items.map((i) => toItemPayload(i));
}

/** Convert AiSuggestedItem[] to BinItem[] with client-side IDs. */
export function aiItemsToBinItems(items: AiSuggestedItem[]): BinItem[] {
  return items.map((i) => ({ id: clientItemId(), name: i.name, quantity: i.quantity ?? null }));
}

/** Parse a bare integer quantity string. Returns null for empty, non-numeric, or negative input. */
export function parseBareQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse human-typed quantity syntax from a single item string. */
export function parseItemQuantity(raw: string): { name: string; quantity: number | null } {
  const s = raw.trim();
  if (!s) return { name: '', quantity: null };

  // 1. Trailing ` x\d+` or ` x \d+`
  const trailingX = s.match(/^(.+)\s+x\s?(\d+)$/i);
  if (trailingX) {
    const qty = Number.parseInt(trailingX[2], 10);
    if (qty >= 1) return { name: trailingX[1].trim(), quantity: qty };
  }

  // 2. Trailing ` (\d+)` in parentheses
  const trailingParen = s.match(/^(.+)\s+\((\d+)\)$/);
  if (trailingParen) {
    const qty = Number.parseInt(trailingParen[2], 10);
    if (qty >= 1) return { name: trailingParen[1].trim(), quantity: qty };
  }

  // 3. Leading `\d+x ` — but NOT ambiguous product names like "2x4"
  const leadingX = s.match(/^(\d+)x\s+(.+)$/i);
  if (leadingX) {
    const rest = leadingX[2];
    // Ambiguity rule: first char after space must be non-digit
    if (rest.length > 0 && !/^\d/.test(rest)) {
      const qty = Number.parseInt(leadingX[1], 10);
      if (qty >= 1) return { name: rest.trim(), quantity: qty };
    }
  }

  // 4. Trailing `, \d+` where last comma-segment is purely numeric
  const lastComma = s.lastIndexOf(',');
  if (lastComma !== -1) {
    const afterComma = s.slice(lastComma + 1).trim();
    if (/^\d+$/.test(afterComma)) {
      const qty = Number.parseInt(afterComma, 10);
      if (qty >= 1) return { name: s.slice(0, lastComma).trim(), quantity: qty };
    }
  }

  // 5. No match
  return { name: s, quantity: null };
}

/** Map parsed item results to the API submission format. */
export function toItemPayload(
  parsed: { name: string; quantity: number | null },
): string | { name: string; quantity: number } {
  return parsed.quantity != null ? { name: parsed.name, quantity: parsed.quantity } : parsed.name;
}

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
