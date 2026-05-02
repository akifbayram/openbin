import { EventEmitter } from 'node:events';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const streamTextMock = vi.fn();
vi.mock('ai', () => ({
  streamText: (args: unknown) => streamTextMock(args),
  Output: { object: (cfg: unknown) => ({ __output: cfg }) },
}));

const { streamAiToWriter, withClientDisconnect } = await import('../aiStream.js');

function makeReq() {
  const emitter = new EventEmitter();
  return emitter as unknown as Request & EventEmitter;
}

function makeStreamResult() {
  return {
    textStream: (async function* () { yield '{"ok":true}'; })(),
    text: Promise.resolve('{"ok":true}'),
    output: Promise.resolve(undefined),
  };
}

describe('withClientDisconnect', () => {
  it("aborts when req emits 'close'", () => {
    const req = makeReq();
    const signal = withClientDisconnect(req);

    expect(signal.aborted).toBe(false);

    req.emit('close');

    expect(signal.aborted).toBe(true);
  });

  it('aborts when the base signal aborts (timeout case)', () => {
    const base = new AbortController();
    const req = makeReq();
    const signal = withClientDisconnect(req, base.signal);

    expect(signal.aborted).toBe(false);

    base.abort();

    expect(signal.aborted).toBe(true);
  });
});

describe('streamAiToWriter — provider options', () => {
  beforeEach(() => {
    streamTextMock.mockReset();
    streamTextMock.mockReturnValue(makeStreamResult());
  });

  it('injects Gemini 3 thinkingLevel for gemini-3-flash-preview', async () => {
    const writeEvent = vi.fn();
    await streamAiToWriter(writeEvent, { modelId: 'gemini-3-flash-preview' } as never, {
      system: 's',
      userContent: [{ type: 'text' as const, text: 'hi' }],
    });

    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const args = streamTextMock.mock.calls[0][0];
    expect(args.providerOptions).toEqual({
      google: { thinkingConfig: { thinkingLevel: 'minimal' } },
    });
  });

  it('does not set providerOptions for non-Gemini-3 models', async () => {
    const writeEvent = vi.fn();
    await streamAiToWriter(writeEvent, { modelId: 'gemini-2.5-flash' } as never, {
      system: 's',
      userContent: [{ type: 'text' as const, text: 'hi' }],
    });

    const args = streamTextMock.mock.calls[0][0];
    expect(args.providerOptions).toBeUndefined();
  });

  it('does not set providerOptions for OpenAI models', async () => {
    const writeEvent = vi.fn();
    await streamAiToWriter(writeEvent, { modelId: 'gpt-5-mini' } as never, {
      system: 's',
      userContent: [{ type: 'text' as const, text: 'hi' }],
    });

    const args = streamTextMock.mock.calls[0][0];
    expect(args.providerOptions).toBeUndefined();
  });
});
