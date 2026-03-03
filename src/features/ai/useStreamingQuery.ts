import { useCallback, useMemo } from 'react';
import { useAiStream } from './useAiStream';
import type { QueryResult } from './useInventoryQuery';

export function useStreamingQuery() {
  const { result, isStreaming, error, partialText, stream, cancel, clear: clearStream } = useAiStream<QueryResult>(
    '/api/ai/query/stream',
    'Query failed'
  );

  const query = useCallback(
    (options: { question: string; locationId: string }) => stream(options),
    [stream]
  );

  const answer = result?.answer ?? '';
  const matches = result?.matches ?? [];

  const clear = useCallback(() => {
    clearStream();
  }, [clearStream]);

  return useMemo(() => ({
    answer, matches, isStreaming, error, partialText, query, cancel, clear,
  }), [answer, matches, isStreaming, error, partialText, query, cancel, clear]);
}
