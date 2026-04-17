import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../apiStream';

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    upgradeUrl?: string | null;
    constructor(status: number, message: string, code?: string, upgradeUrl?: string | null) {
      super(message);
      this.status = status;
      this.code = code;
      this.upgradeUrl = upgradeUrl;
    }
  },
  tryRefresh: vi.fn(),
  readCsrfTokenFromCookie: vi.fn(() => null),
}));

import { ApiError, tryRefresh } from '../api';
import { apiStream } from '../apiStream';

function mockStreamResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

async function collect(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('apiStream', () => {
  it('parses SSE events into StreamEvent objects', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockStreamResponse(['data: {"type":"delta","text":"hello"}\n', 'data: {"type":"done","text":"hello"}\n']),
    );
    const events = await collect(apiStream('/test', { body: {} }));
    expect(events).toEqual([
      { type: 'delta', text: 'hello' },
      { type: 'done', text: 'hello' },
    ]);
  });

  it('handles event split across chunks', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockStreamResponse(['data: {"type":"del', 'ta","text":"hi"}\n']),
    );
    const events = await collect(apiStream('/test', { body: {} }));
    expect(events).toEqual([{ type: 'delta', text: 'hi' }]);
  });

  it('yields multiple events from a single chunk', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockStreamResponse(['data: {"type":"delta","text":"a"}\ndata: {"type":"delta","text":"b"}\n']),
    );
    const events = await collect(apiStream('/test', { body: {} }));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'delta', text: 'a' });
    expect(events[1]).toEqual({ type: 'delta', text: 'b' });
  });

  it('401 triggers tryRefresh and retries on success', async () => {
    const mockTryRefresh = vi.mocked(tryRefresh);
    mockTryRefresh.mockResolvedValue(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(mockStreamResponse(['data: {"type":"done","text":"ok"}\n']));

    const events = await collect(apiStream('/test', { body: {} }));
    expect(mockTryRefresh).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(events).toEqual([{ type: 'done', text: 'ok' }]);
  });

  it('401 dispatches auth-expired when refresh fails', async () => {
    vi.mocked(tryRefresh).mockResolvedValue(false);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    const handler = vi.fn();
    window.addEventListener('openbin-auth-expired', handler);

    const events = await collect(apiStream('/test', { body: {} }));
    expect(events).toEqual([]);
    expect(handler).toHaveBeenCalled();

    window.removeEventListener('openbin-auth-expired', handler);
  });

  it('non-OK response throws ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'FORBIDDEN', message: 'nope' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(collect(apiStream('/test', { body: {} }))).rejects.toThrow('nope');
    await expect(
      collect(apiStream('/test', { body: {} })),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('malformed JSON in event is skipped', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockStreamResponse(['data: {bad json}\ndata: {"type":"delta","text":"ok"}\n']),
    );
    const events = await collect(apiStream('/test', { body: {} }));
    expect(events).toEqual([{ type: 'delta', text: 'ok' }]);
  });

  it('buffer exceeding 1MB yields overflow error', async () => {
    const bigChunk = 'x'.repeat(1024 * 1024 + 1);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockStreamResponse([bigChunk]));
    const events = await collect(apiStream('/test', { body: {} }));
    expect(events).toEqual([{ type: 'error', message: 'Response too large', code: 'STREAM_OVERFLOW' }]);
  });

  it('reader is released after iteration completes', async () => {
    const releaseLock = vi.fn();
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"done","text":"x"}\n') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock,
      cancel: vi.fn(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    await collect(apiStream('/test', { body: {} }));
    expect(releaseLock).toHaveBeenCalled();
  });

  it('no reader (null body) returns immediately', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    } as unknown as Response);

    const events = await collect(apiStream('/test', { body: {} }));
    expect(events).toEqual([]);
  });
});
