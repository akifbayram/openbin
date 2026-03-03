import { useCallback, useMemo } from 'react';
import { useAiStream } from './useAiStream';
import type { CommandResult } from './useCommand';

export function useStreamingCommand() {
  const { result, isStreaming, error, stream, cancel, clear: clearStream } = useAiStream<CommandResult>(
    '/api/ai/command/stream',
    "Couldn't understand that command"
  );

  const parse = useCallback(
    (options: { text: string; locationId: string }) => stream(options),
    [stream]
  );

  const actions = result?.actions ?? null;
  const interpretation = result?.interpretation ?? '';

  const clear = useCallback(() => {
    clearStream();
  }, [clearStream]);

  return useMemo(() => ({
    actions, interpretation, isStreaming, error, parse, cancel, clear,
  }), [actions, interpretation, isStreaming, error, parse, cancel, clear]);
}
