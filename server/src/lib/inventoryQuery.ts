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

export function buildSystemPrompt(customPrompt?: string): string {
  const basePrompt = customPrompt || DEFAULT_QUERY_PROMPT;

  return `${basePrompt}

IMPORTANT: The "answer" and "matches" fields are both REQUIRED. If no bins match, return an empty matches array.`;
}

export function buildUserMessage(question: string, context: InventoryContext): string {
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

