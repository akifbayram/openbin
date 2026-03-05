import { useCallback, useMemo } from 'react';
import { useAiStream } from './useAiStream';
import type { QueryResult } from './useInventoryQuery';

export function useStreamingQuery() {
  const { isStreaming, error, partialText, stream, cancel, clear: clearStream } = useAiStream<QueryResult>(
    '/api/ai/query/stream',
    'Query failed'
  );

  const query = useCallback(
    (options: { question: string; locationId: string }) => stream(options),
    [stream]
  );

  return useMemo(() => ({
    isStreaming, error, partialText, query, cancel, clear: clearStream,
  }), [isStreaming, error, partialText, query, cancel, clearStream]);
}
