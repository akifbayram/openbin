import { HARDENING_INSTRUCTION, resolvePrompt, sanitizeForPrompt } from './aiSanitize.js';
import { DEFAULT_QUERY_PROMPT } from './defaultPrompts.js';

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
  areas: Array<{ id: string; name: string }>;
  trash_bins: Array<{ id: string; name: string }>;
}

export function buildSystemPrompt(customPrompt?: string, isDemoUser?: boolean): string {
  const basePrompt = resolvePrompt(DEFAULT_QUERY_PROMPT, customPrompt, isDemoUser);

  return `${basePrompt}

IMPORTANT: The "answer" and "matches" fields are both REQUIRED. If no bins match, return an empty matches array.${HARDENING_INSTRUCTION}`;
}

export function buildUserMessage(question: string, context: InventoryContext): string {
  return `Question: ${sanitizeForPrompt(question)}

<user_data type="inventory" trust="none">
${JSON.stringify(context)}
</user_data>`;
}

