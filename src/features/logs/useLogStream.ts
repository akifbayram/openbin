import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  ip?: string;
  message?: string;
}

const MAX_CLIENT_ENTRIES = 1000;

export function useLogStream() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clear = useCallback(() => setEntries([]), []);

  useEffect(() => {
    let cancelled = false;

    // 1. Fetch initial entries
    apiFetch<{ results: LogEntry[]; count: number }>('/api/admin/logs')
      .then((data) => {
        if (cancelled) return;
        setEntries(data.results);
        setIsLoading(false);

        // 2. Open SSE stream
        const es = new EventSource('/api/admin/logs/stream', { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!cancelled) setConnected(true);
        };

        es.onmessage = (event) => {
          if (cancelled) return;
          try {
            const entry: LogEntry = JSON.parse(event.data);
            setEntries((prev) => {
              const next = [...prev, entry];
              return next.length > MAX_CLIENT_ENTRIES
                ? next.slice(next.length - MAX_CLIENT_ENTRIES)
                : next;
            });
          } catch {
            /* ignore malformed */
          }
        };

        es.onerror = () => {
          if (!cancelled) setConnected(false);
        };
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  return { entries, connected, isLoading, clear };
}
