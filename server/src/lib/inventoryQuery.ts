import { resolvePrompt, sanitizeForPrompt, withHardening } from './aiSanitize.js';
import { DEFAULT_QUERY_PROMPT, QUERY_RESPONSE_SHAPE } from './defaultPrompts.js';

export interface QueryMatch {
  bin_id: string;
  name: string;
  area_name: string;
  items: string[];
  tags: string[];
  relevance: string;
  is_trashed?: boolean;
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
