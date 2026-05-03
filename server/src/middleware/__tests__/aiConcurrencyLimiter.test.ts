import { EventEmitter } from 'node:events';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createAiConcurrencyLimiter } from '../aiConcurrencyLimiter.js';

function makeReq(userId?: string): Request {
  return { user: userId ? { id: userId } : undefined } as unknown as Request;
}

function makeRes(): Response & EventEmitter {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });
  return res as unknown as Response & EventEmitter;
}

function dispatch(limiter: RequestHandler, userId?: string) {
  const req = makeReq(userId);
  const res = makeRes();
  const next = vi.fn() as unknown as NextFunction;
  limiter(req, res, next);
  return { req, res, next };
}

describe('createAiConcurrencyLimiter', () => {
  it('allows requests up to cap and rejects the (cap+1)th with 429', () => {
    const limiter = createAiConcurrencyLimiter(2);

    const a = dispatch(limiter, 'user-1');
    const b = dispatch(limiter, 'user-1');
    const c = dispatch(limiter, 'user-1');

    expect(a.next).toHaveBeenCalledTimes(1);
    expect(b.next).toHaveBeenCalledTimes(1);
    expect(c.next).not.toHaveBeenCalled();
    expect(c.res.status).toHaveBeenCalledWith(429);
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'AI_CONCURRENCY_LIMITED' }),
    );
  });

  it("releases a slot when an in-flight response emits 'close'", () => {
    const limiter = createAiConcurrencyLimiter(2);

    const a = dispatch(limiter, 'user-1');
    dispatch(limiter, 'user-1');
    a.res.emit('close');
    const c = dispatch(limiter, 'user-1');

    expect(c.next).toHaveBeenCalledTimes(1);
    expect(c.res.status).not.toHaveBeenCalled();
  });

  it('keys in-flight counts per user via req.user.id', () => {
    const limiter = createAiConcurrencyLimiter(1);

    const a = dispatch(limiter, 'user-A');
    const b = dispatch(limiter, 'user-B');

    expect(a.next).toHaveBeenCalledTimes(1);
    expect(b.next).toHaveBeenCalledTimes(1);
    expect(a.res.status).not.toHaveBeenCalled();
    expect(b.res.status).not.toHaveBeenCalled();
  });

  it('is a no-op when req.user is missing (does not consume a slot)', () => {
    const limiter = createAiConcurrencyLimiter(1);

    const r = dispatch(limiter);

    expect(r.next).toHaveBeenCalledTimes(1);
    expect(r.next).toHaveBeenCalledWith();
    expect(r.res.status).not.toHaveBeenCalled();
  });
});
