import { ApiError, readCsrfTokenFromCookie, tryRefresh } from './api';
import { Events, notify } from './eventBus';

export interface StreamDeltaEvent {
  type: 'delta';
  text: string;
}

export interface StreamDoneEvent {
  type: 'done';
  text: string;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
  code: string;
}

export interface StreamRetryEvent {
  type: 'retry';
  attempt: number;
}

export type StreamEvent = StreamDeltaEvent | StreamDoneEvent | StreamErrorEvent | StreamRetryEvent;

/**
 * Consume a server-sent event stream from an AI streaming endpoint.
 *
 * Yields StreamEvent objects as they arrive. The caller is responsible
 * for deciding how to render deltas vs the final done payload.
 *
 * Handles 401 auto-refresh identically to apiFetch().
 */
export async function* apiStream(
  path: string,
  options: { body: unknown; signal?: AbortSignal },
  isRetry = false
): AsyncGenerator<StreamEvent> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const csrf = readCsrfTokenFromCookie();
  if (csrf) headers['X-CSRF-Token'] = csrf;

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: isFormData ? (options.body as FormData) : JSON.stringify(options.body),
    credentials: 'same-origin',
    signal: options.signal,
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      yield* apiStream(path, options, true);
      return;
    }
    window.dispatchEvent(new CustomEvent('openbin-auth-expired'));
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    const code = data.error as string | undefined;
    const upgradeUrl = data.upgrade_url as string | null | undefined;
    if (code === 'PLAN_RESTRICTED' || code === 'SUBSCRIPTION_EXPIRED' || code === 'AI_CREDITS_EXHAUSTED') {
      notify(Events.PLAN);
      window.dispatchEvent(new CustomEvent('openbin-plan-restricted', { detail: { code, message: data.message, upgradeUrl } }));
    }
    throw new ApiError(res.status, data.message || data.error || res.statusText, code, upgradeUrl);
  }

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 1024 * 1024) { // 1 MB safety limit
        yield { type: 'error' as const, message: 'Response too large', code: 'STREAM_OVERFLOW' };
        reader.cancel();
        break;
      }
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (!json) continue;
        try {
          const parsed = JSON.parse(json);
          if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
            yield parsed as StreamEvent;
          }
        } catch {
          // Malformed event — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
