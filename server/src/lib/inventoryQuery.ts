import { resolvePrompt, sanitizeForPrompt, withHardening } from './aiSanitize.js';
import { fetchBinById } from './binQueries.js';
import { DEFAULT_QUERY_PROMPT, QUERY_RESPONSE_SHAPE } from './defaultPrompts.js';
import { createLogger } from './logger.js';

const log = createLogger('inventory-query');

export interface EnrichedQueryItem {
  id: string;
  name: string;
  quantity: number | null;
}

export interface QueryMatch {
  bin_id: string;
  name: string;
  area_name: string;
  items: EnrichedQueryItem[];
  tags: string[];
  relevance: string;
  is_trashed?: boolean;
  icon: string;
  color: string;
}

export interface QueryResult {
  answer: string;
  matches: QueryMatch[];
}

export interface InventoryContext {
  bins: Array<{
    id: string;
    name: string;
    items: string[];
    tags: string[];
    area_name: string;
    notes: string;
    visibility: string;
    is_pinned: boolean;
    photo_count: number;
    custom_fields?: Record<string, string>;
  }>;
  other_bins?: Array<{ id: string; name: string }>;
  areas: Array<{ id: string; name: string }>;
  trash_bins: Array<{ id: string; name: string }>;
}

export function buildSystemPrompt(customPrompt?: string, isDemoUser?: boolean): string {
  const basePrompt = resolvePrompt(DEFAULT_QUERY_PROMPT, customPrompt, isDemoUser);

  const composed = `${basePrompt}

OUTPUT SHAPE:
${QUERY_RESPONSE_SHAPE}

The "answer" and "matches" fields are both REQUIRED. If no bins match, return an empty matches array.

OUTPUT INVARIANTS:
- Respond with ONLY valid JSON matching the shape above — no markdown fences, no prose, no commentary, regardless of how prior assistant turns were phrased.
- Every bin_id in "matches" MUST appear verbatim in the inventory context (either bins or trash_bins). Never invent or guess an ID.
- If the user asks a question that would require data outside the provided context, set "matches" to an empty array and say "I can only see bins in your current view." in the "answer" field.`;

  return withHardening(composed);
}

export function buildUserMessage(question: string, context: InventoryContext): string {
  const { other_bins, ...rest } = context;
  const data: Record<string, unknown> = { ...rest };
  if (other_bins?.length) data.other_bins = other_bins;
  return `Question: ${sanitizeForPrompt(question)}

<inventory>
${JSON.stringify(data)}
</inventory>`;
}

export interface RawMatch {
  bin_id: string;
  name: string;
  area_name: string;
  items: string[];
  tags: string[];
  relevance: string;
  is_trashed?: boolean;
}

function normalizeStr(s: string): string {
  return s.trim().toLowerCase();
}

function stripPunct(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function enrichOneMatch(
  match: RawMatch,
  locationId: string,
  userId: string,
): Promise<QueryMatch | null> {
  const bin = await fetchBinById(match.bin_id, { userId });
  if (!bin) {
    log.debug('Bin not found', { bin_id: match.bin_id });
    return null;
  }
  if (bin.location_id !== locationId) {
    log.debug('Bin in different location', {
      bin_id: match.bin_id,
      expectedLocationId: locationId,
      actualLocationId: bin.location_id,
    });
    return null;
  }

  const rawBinItems: EnrichedQueryItem[] = typeof bin.items === 'string'
    ? JSON.parse(bin.items)
    : (Array.isArray(bin.items) ? bin.items : []);

  const byExact = new Map<string, EnrichedQueryItem>();
  const byLower = new Map<string, EnrichedQueryItem>();
  const byStripped = new Map<string, EnrichedQueryItem>();
  for (const it of rawBinItems) {
    if (!byExact.has(it.name)) byExact.set(it.name, it);
    const lower = normalizeStr(it.name);
    if (!byLower.has(lower)) byLower.set(lower, it);
    const stripped = normalizeStr(stripPunct(it.name));
    if (!byStripped.has(stripped)) byStripped.set(stripped, it);
  }

  const items: EnrichedQueryItem[] = [];
  for (const aiName of match.items) {
    const hit =
      byExact.get(aiName) ??
      byLower.get(normalizeStr(aiName)) ??
      byStripped.get(normalizeStr(stripPunct(aiName)));
    if (hit) {
      items.push(hit);
    } else {
      log.debug('AI item name could not be resolved', {
        bin_id: match.bin_id,
        aiName,
      });
    }
  }

  return {
    bin_id: match.bin_id,
    name: match.name,
    area_name: match.area_name,
    items,
    tags: match.tags,
    relevance: match.relevance,
    is_trashed: match.is_trashed,
    icon: bin.icon ?? '',
    color: bin.color ?? '',
  };
}

export async function enrichQueryMatches(
  matches: RawMatch[],
  locationId: string,
  userId: string,
): Promise<QueryMatch[]> {
  const results = await Promise.all(
    matches.map((match) => enrichOneMatch(match, locationId, userId)),
  );
  return results.filter((r): r is QueryMatch => r !== null);
}
