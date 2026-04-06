export type Intent = 'command' | 'query' | 'ambiguous';

const QUERY_START =
  /^(where|what|which|how many|do i have|is there|are there|any|find|search|show|list|tell me|count|does|can you find|can you show|can you list)/i;

const COMMAND_START =
  /^(add|remove|delete|create|move|rename|set|change|update|put|take|pin|unpin|duplicate|restore|reorder|tag|untag|clear|make|mark|assign|merge|split)/i;

/** Classify user input as command or query using keyword heuristics. */
export function classifyIntent(text: string): Intent {
  const trimmed = text.trim();

  // Strong query signals — questions
  if (QUERY_START.test(trimmed)) return 'query';
  if (/\?\s*$/.test(trimmed)) return 'query';

  // Strong command signals — imperatives
  if (COMMAND_START.test(trimmed)) return 'command';

  return 'ambiguous';
}
