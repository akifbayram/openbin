import { useCallback, useMemo } from 'react';
import { useAiStream } from './useAiStream';
import type { CommandAction, CommandResult } from './useCommand';

function isValidAction(a: unknown): a is CommandAction {
  return typeof a === 'object' && a !== null && typeof (a as Record<string, unknown>).type === 'string';
}

export function useStreamingCommand() {
  const { result, isStreaming, error, stream, cancel, clear: clearStream } = useAiStream<CommandResult>(
    '/api/ai/command/stream',
    "Couldn't understand that command"
  );

  const parse = useCallback(
    (options: { text: string; locationId: string }) => stream(options),
    [stream]
  );

  // Filter out malformed actions (e.g. empty objects from AI)
  const actions = useMemo(
    () => result?.actions?.filter(isValidAction) ?? null,
    [result],
  );
  const interpretation = result?.interpretation ?? '';

  const clear = useCallback(() => {
    clearStream();
  }, [clearStream]);

  return useMemo(() => ({
    actions, interpretation, isStreaming, error, parse, cancel, clear,
  }), [actions, interpretation, isStreaming, error, parse, cancel, clear]);
}
