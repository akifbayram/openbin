import type { AiProviderConfig } from './aiCaller.js';
import { callAiProvider } from './aiCaller.js';
import { DEFAULT_QUERY_PROMPT } from './defaultPrompts.js';

export interface QueryMatch {
  bin_id: string;
  name: string;
  area_name: string;
  items: string[];
  tags: string[];
  relevance: string;
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
  }>;
  areas: Array<{ id: string; name: string }>;
  trash_bins: Array<{ id: string; name: string }>;
}

function buildSystemPrompt(customPrompt?: string): string {
  const basePrompt = customPrompt || DEFAULT_QUERY_PROMPT;

  return `${basePrompt}

Respond with ONLY valid JSON, no markdown fences, no extra text. Format:
{"answer":"Your natural language answer here","matches":[{"bin_id":"uuid","name":"Bin Name","area_name":"Area","items":["relevant items"],"tags":["relevant tags"],"relevance":"why this matched"}]}

IMPORTANT: The "answer" and "matches" fields are both REQUIRED. If no bins match, return an empty matches array.`;
}

function buildUserMessage(question: string, context: InventoryContext): string {
  const binsContext = context.bins.map((b) => ({
    id: b.id,
    name: b.name,
    items: b.items,
    tags: b.tags,
    area_name: b.area_name,
    notes: b.notes.length > 200 ? `${b.notes.slice(0, 200)}...` : b.notes,
    visibility: b.visibility,
    is_pinned: b.is_pinned,
    photo_count: b.photo_count,
  }));

  const areasContext = context.areas.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const trashContext = context.trash_bins;

  return `Question: ${question}

Inventory:
${JSON.stringify({ bins: binsContext, areas: areasContext, trash_bins: trashContext })}`;
}

function validateQueryResult(raw: unknown, validBinIds: Set<string>): QueryResult {
  const obj = raw as Record<string, unknown>;
  const answer = typeof obj.answer === 'string' ? obj.answer : 'Unable to process query';

  const matches: QueryMatch[] = [];
  if (Array.isArray(obj.matches)) {
    for (const m of obj.matches) {
      if (!m || typeof m !== 'object') continue;
      const match = m as Record<string, unknown>;
      if (typeof match.bin_id !== 'string' || !validBinIds.has(match.bin_id)) continue;
      matches.push({
        bin_id: match.bin_id as string,
        name: typeof match.name === 'string' ? match.name : '',
        area_name: typeof match.area_name === 'string' ? match.area_name : '',
        items: Array.isArray(match.items) ? (match.items as unknown[]).filter((i): i is string => typeof i === 'string') : [],
        tags: Array.isArray(match.tags) ? (match.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
        relevance: typeof match.relevance === 'string' ? match.relevance : '',
      });
    }
  }

  return { answer, matches };
}

export interface QueryOverrides {
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  request_timeout?: number | null;
}

export async function queryInventory(
  config: AiProviderConfig,
  question: string,
  context: InventoryContext,
  customPrompt?: string,
  overrides?: QueryOverrides
): Promise<QueryResult> {
  const validBinIds = new Set(context.bins.map((b) => b.id));

  return callAiProvider({
    config,
    systemPrompt: buildSystemPrompt(customPrompt),
    userContent: buildUserMessage(question, context),
    temperature: overrides?.temperature ?? 0.3,
    maxTokens: overrides?.max_tokens ?? 2000,
    topP: overrides?.top_p ?? undefined,
    timeoutMs: overrides?.request_timeout ? overrides.request_timeout * 1000 : undefined,
    validate: (raw) => validateQueryResult(raw, validBinIds),
  });
}
