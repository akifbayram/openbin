import { useCallback, useRef, useState } from 'react';
import { apiStream } from '@/lib/apiStream';
import { mapAiError } from './aiErrors';

/**
 * Generic hook for consuming an SSE AI streaming endpoint.
 *
 * Returns the parsed result from the `done` event, streaming state, error,
 * and cancel/clear helpers. Concrete hooks wrap this with endpoint-specific
 * state (e.g. `actions`/`interpretation` or `answer`/`matches`).
 */
export function useAiStream<T>(
  endpoint: string,
  errorFallback: string
) {
  const [result, setResult] = useState<T | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialText, setPartialText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(async (body: object): Promise<T | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setError(null);
    setResult(null);
    setPartialText('');

    try {
      for await (const event of apiStream(endpoint, {
        body,
        signal: controller.signal,
      })) {
        if (event.type === 'delta') {
          setPartialText(prev => prev + event.text);
        } else if (event.type === 'done') {
          try {
            // Strip markdown code block wrappers if present
            let text = event.text.trim();
            const fenced = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
            if (fenced) text = fenced[1].trim();
            if (!text) {
              setError(`${errorFallback} — empty response from AI`);
              return null;
            }
            const parsed = JSON.parse(text) as T;
            setResult(parsed);
            return parsed;
          } catch {
            setError(`${errorFallback} — unexpected response format`);
          }
        } else if (event.type === 'error') {
          setError(event.message);
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(mapAiError(err, errorFallback));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
    return null;
  }, [endpoint, errorFallback]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setPartialText('');
  }, []);

  return { result, isStreaming, error, partialText, stream, cancel, clear };
}
