import type { ModelMessage } from 'ai';

/** Maximum number of turns sent to the AI provider. Older turns are dropped. */
export const MAX_TURNS = 10;

/** Maximum textual content length for a single turn. Larger turns are dropped. */
export const MAX_TURN_CHARS = 4096;

/** Maximum cumulative textual content across all retained turns. Oldest turns are trimmed first. */
export const MAX_TOTAL_CHARS = 32768;

/** Wire format for a conversation turn from the client. */
export type ConversationTurn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; kind: 'answer'; content: string; matchedBinIds?: string[] }
  | {
      role: 'assistant';
      kind: 'command';
      interpretation: string;
      actions: Array<Record<string, unknown>>;
      executed: boolean;
      executedActionIndices?: number[];
      failedCount?: number;
    };

/** Trim history to the last MAX_TURNS entries. */
export function trimHistory(history: ConversationTurn[] | undefined): ConversationTurn[] {
  if (!history || history.length === 0) return [];
  if (history.length <= MAX_TURNS) return history;
  return history.slice(history.length - MAX_TURNS);
}

/** Compact a command turn into a natural-language summary for the AI provider. */
function compactCommandTurn(turn: Extract<ConversationTurn, { kind: 'command' }>): string {
  const prefix = turn.executed ? 'Executed' : 'Proposed (not executed)';
  const interp = turn.interpretation.trim();
  const count = turn.executed
    ? (turn.executedActionIndices?.length ?? turn.actions.length)
    : turn.actions.length;
  const countLabel = `${count} action${count === 1 ? '' : 's'}`;
  const failures = turn.failedCount ?? 0;
  const errors = failures > 0 ? ` (${failures} failed)` : '';
  const body = interp ? `${interp} — ${countLabel}` : countLabel;
  return `${prefix}: ${body}${errors}.`;
}

/** Convert a client-supplied history array into the provider-agnostic messages array. */
export function toProviderMessages(history: ConversationTurn[]): ModelMessage[] {
  return history.map((turn): ModelMessage => {
    if (turn.role === 'user') {
      return { role: 'user', content: turn.content };
    }
    if (turn.kind === 'answer') {
      return { role: 'assistant', content: turn.content };
    }
    return { role: 'assistant', content: compactCommandTurn(turn) };
  });
}

/**
 * Parse the `history` field from an arbitrary object (typically `req.body`) and convert it
 * to a ready-to-use `ModelMessage[]`. Returns `[]` if the field is absent, non-array, or
 * contains no valid turns. Individual malformed turns are dropped.
 */
export function parseHistoryFromBody(body: unknown): ModelMessage[] {
  const raw = (body as { history?: unknown } | null | undefined)?.history;
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter(isValidTurn).filter(isWithinSizeLimit);
  return toProviderMessages(trimToTotalCharBudget(trimHistory(valid)));
}

/** Drop oldest turns until cumulative textual content fits within MAX_TOTAL_CHARS. */
function trimToTotalCharBudget(history: ConversationTurn[]): ConversationTurn[] {
  let total = history.reduce((sum, t) => sum + turnContentLength(t), 0);
  let i = 0;
  while (total > MAX_TOTAL_CHARS && i < history.length) {
    total -= turnContentLength(history[i]);
    i++;
  }
  return i === 0 ? history : history.slice(i);
}

/** Length of the textual field that counts against the size budget. */
function turnContentLength(t: ConversationTurn): number {
  if (t.role === 'user') return t.content.length;
  if (t.kind === 'answer') return t.content.length;
  return t.interpretation.length;
}

/** Runtime guard: is this turn's textual content within MAX_TURN_CHARS? */
function isWithinSizeLimit(t: ConversationTurn): boolean {
  return turnContentLength(t) <= MAX_TURN_CHARS;
}

/** Runtime guard: does this value match the ConversationTurn discriminated union? */
function isValidTurn(t: unknown): t is ConversationTurn {
  if (t === null || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  if (o.role === 'user') {
    return typeof o.content === 'string';
  }
  if (o.role === 'assistant') {
    if (o.kind === 'answer') {
      return typeof o.content === 'string';
    }
    if (o.kind === 'command') {
      if (
        typeof o.interpretation !== 'string' ||
        !Array.isArray(o.actions) ||
        typeof o.executed !== 'boolean'
      )
        return false;
      if (o.failedCount !== undefined && typeof o.failedCount !== 'number') return false;
      return true;
    }
  }
  return false;
}
