import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetAiConcurrencyForTest,
  createAiConcurrencyLimiter,
} from '../aiConcurrencyLimiter.js';

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

describe('createAiConcurrencyLimiter', () => {
  beforeEach(() => {
    __resetAiConcurrencyForTest();
  });

  it('allows requests up to cap and rejects the (cap+1)th with 429', () => {
    const limiter = createAiConcurrencyLimiter(2);

    const req1 = makeReq('user-1');
    const res1 = makeRes();
    const next1 = vi.fn() as unknown as NextFunction;
    limiter(req1, res1, next1);

    const req2 = makeReq('user-1');
    const res2 = makeRes();
    const next2 = vi.fn() as unknown as NextFunction;
    limiter(req2, res2, next2);

    const req3 = makeReq('user-1');
    const res3 = makeRes();
    const next3 = vi.fn() as unknown as NextFunction;
    limiter(req3, res3, next3);

    expect(next1).toHaveBeenCalledTimes(1);
    expect(next2).toHaveBeenCalledTimes(1);
    expect(next3).not.toHaveBeenCalled();
    expect(res3.status).toHaveBeenCalledWith(429);
    expect(res3.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'AI_CONCURRENCY_LIMITED' }),
    );
  });

  it("releases a slot when an in-flight response emits 'close'", () => {
    const limiter = createAiConcurrencyLimiter(2);

    const req1 = makeReq('user-1');
    const res1 = makeRes();
    const next1 = vi.fn() as unknown as NextFunction;
    limiter(req1, res1, next1);

    const req2 = makeReq('user-1');
    const res2 = makeRes();
    const next2 = vi.fn() as unknown as NextFunction;
    limiter(req2, res2, next2);

    expect(next1).toHaveBeenCalledTimes(1);
    expect(next2).toHaveBeenCalledTimes(1);

    res1.emit('close');

    const req3 = makeReq('user-1');
    const res3 = makeRes();
    const next3 = vi.fn() as unknown as NextFunction;
    limiter(req3, res3, next3);

    expect(next3).toHaveBeenCalledTimes(1);
    expect(res3.status).not.toHaveBeenCalled();
  });

  it('keys in-flight counts per user via req.user.id', () => {
    const limiter = createAiConcurrencyLimiter(1);

    const reqA = makeReq('user-A');
    const resA = makeRes();
    const nextA = vi.fn() as unknown as NextFunction;
    limiter(reqA, resA, nextA);

    const reqB = makeReq('user-B');
    const resB = makeRes();
    const nextB = vi.fn() as unknown as NextFunction;
    limiter(reqB, resB, nextB);

    expect(nextA).toHaveBeenCalledTimes(1);
    expect(nextB).toHaveBeenCalledTimes(1);
    expect(resA.status).not.toHaveBeenCalled();
    expect(resB.status).not.toHaveBeenCalled();
  });

  it('is a no-op when req.user is missing (does not consume a slot)', () => {
    const limiter = createAiConcurrencyLimiter(1);

    const req = makeReq();
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    expect(() => limiter(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });
});
