import { useCallback, useMemo } from 'react';
import { useAiStream } from './useAiStream';
import type { CommandAction, CommandResult } from './useCommand';
import type { QueryMatch, QueryResult } from './useInventoryQuery';

/** Union of command and query responses from the unified /ask endpoint. */
type AskResult = CommandResult | QueryResult | (CommandResult & QueryResult);

export type AskClassified =
  | { kind: 'command'; actions: CommandAction[]; interpretation: string }
  | { kind: 'query'; answer: string; matches: QueryMatch[] };

function isValidAction(a: unknown): a is CommandAction {
  return typeof a === 'object' && a !== null && typeof (a as Record<string, unknown>).type === 'string';
}

/** Classify unified AI response as command or query based on which fields are present. */
function classifyResult(result: AskResult): AskClassified {
  const asCmd = result as Partial<CommandResult>;
  const asQuery = result as Partial<QueryResult>;

  // If actions array is present and non-empty, treat as command
  if (Array.isArray(asCmd.actions) && asCmd.actions.length > 0) {
    return {
      kind: 'command',
      actions: asCmd.actions.filter(isValidAction),
      interpretation: asCmd.interpretation ?? '',
    };
  }

  // If answer string is present, treat as query
  if (typeof asQuery.answer === 'string') {
    return {
      kind: 'query',
      answer: asQuery.answer,
      matches: Array.isArray(asQuery.matches) ? asQuery.matches : [],
    };
  }

  // Empty actions array → AI couldn't parse a command, treat as query with empty answer
  if (Array.isArray(asCmd.actions) && asCmd.actions.length === 0) {
    return {
      kind: 'query',
      answer: asCmd.interpretation ?? 'I couldn\'t find relevant information for that.',
      matches: [],
    };
  }

  // Fallback: treat as empty query
  return { kind: 'query', answer: '', matches: [] };
}

export function useStreamingAsk() {
  const realStream = useAiStream<AskResult>(
    '/api/ai/ask/stream',
    "Couldn't process that request"
  );

  const demoStream = useAiStream<AskResult>(
    '/api/ai/demo-scenario/stream',
    "Couldn't process that request"
  );

  const ask = useCallback(
    (options: { text: string; locationId: string; binIds?: string[] }) => realStream.stream(options),
    [realStream.stream]
  );

  const demoAsk = useCallback(
    (scenarioKey: string) => demoStream.stream({ demoScenario: scenarioKey }),
    [demoStream.stream]
  );

  const isStreaming = realStream.isStreaming || demoStream.isStreaming;
  const error = realStream.error || demoStream.error;
  const partialText = realStream.partialText || demoStream.partialText;
  const result = realStream.result || demoStream.result;

  const cancel = useCallback(() => {
    realStream.cancel();
    demoStream.cancel();
  }, [realStream.cancel, demoStream.cancel]);

  const clear = useCallback(() => {
    realStream.clear();
    demoStream.clear();
  }, [realStream.clear, demoStream.clear]);

  const classified = useMemo(
    () => (result ? classifyResult(result) : null),
    [result],
  );

  return useMemo(() => ({
    classified, isStreaming, error, partialText, ask, demoAsk, cancel, clear,
  }), [classified, isStreaming, error, partialText, ask, demoAsk, cancel, clear]);
}
