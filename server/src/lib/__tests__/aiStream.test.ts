import { EventEmitter } from 'node:events';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { withClientDisconnect } from '../aiStream.js';

function makeReq() {
  const emitter = new EventEmitter();
  return emitter as unknown as Request & EventEmitter;
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
