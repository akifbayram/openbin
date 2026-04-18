import type { ExecutionResult } from './useActionExecutor';
import type { CommandAction } from './useCommand';
import type { QueryResult } from './useInventoryQuery';

/** Per-turn UI state for the conversation thread. */
export type Turn =
  | { kind: 'user-text'; id: string; text: string; createdAt: number }
  | { kind: 'ai-thinking'; id: string; phase: 'parsing' | 'querying' | 'executing' }
  | {
      kind: 'ai-command-preview';
      id: string;
      actions: CommandAction[];
      interpretation: string;
      checkedActions: Map<number, boolean>;
      status: 'pending' | 'executing' | 'executed' | 'canceled';
      executionResult?: ExecutionResult;
    }
  | {
      kind: 'ai-query-result';
      id: string;
      queryResult: QueryResult;
    }
  | { kind: 'ai-error'; id: string; error: string; canRetry: boolean };

/**
 * Wire format mirroring `server/src/lib/conversationHistory.ts` ConversationTurn.
 * Kept in sync manually — if this changes, update the server type.
 */
export type ConversationTurnPayload =
  | { role: 'user'; content: string }
  | { role: 'assistant'; kind: 'answer'; content: string; matchedBinIds?: string[] }
  | {
      role: 'assistant';
      kind: 'command';
      interpretation: string;
      actions: CommandAction[];
      executed: boolean;
      executedActionIndices?: number[];
      failedCount?: number;
    };

/** Generate a unique turn id. */
export function createTurnId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build the `history` payload from local turns for sending to the server.
 * Excludes thinking and error turns (not useful for the AI).
 * For executed command turns, reads `executedActionIndices` and `failedCount`
 * directly from the `ExecutionResult` recorded by the action executor.
 */
export function buildHistoryPayload(turns: Turn[]): ConversationTurnPayload[] {
  const payload: ConversationTurnPayload[] = [];
  for (const turn of turns) {
    if (turn.kind === 'user-text') {
      payload.push({ role: 'user', content: turn.text });
    } else if (turn.kind === 'ai-query-result') {
      payload.push({
        role: 'assistant',
        kind: 'answer',
        content: turn.queryResult.answer,
        matchedBinIds: turn.queryResult.matches.map((m) => m.bin_id),
      });
    } else if (turn.kind === 'ai-command-preview') {
      const executed = turn.status === 'executed';
      const entry: ConversationTurnPayload = {
        role: 'assistant',
        kind: 'command',
        interpretation: turn.interpretation,
        actions: turn.actions,
        executed,
      };
      if (executed && turn.executionResult) {
        entry.executedActionIndices = turn.executionResult.completedActionIndices;
        if (turn.executionResult.failedCount > 0) {
          entry.failedCount = turn.executionResult.failedCount;
        }
      }
      payload.push(entry);
    }
    // ai-thinking, ai-error turns are skipped
  }
  return payload;
}
