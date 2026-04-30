import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** In-flight request count per authenticated user id. */
const inFlight = new Map<string, number>();

/**
 * Per-user concurrency cap for AI streaming endpoints. Counts in-flight requests
 * by `req.user.id`; rejects with 429 when the user already holds `cap` slots.
 * Slots are released when the response emits `'close'` (normal end OR client
 * disconnect both fire it).
 *
 * Unauthenticated requests pass through without consuming a slot — auth
 * middleware should reject earlier; this guard exists only so the limiter
 * cannot crash when ordering is changed.
 */
export function createAiConcurrencyLimiter(cap: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }

    const current = inFlight.get(userId) ?? 0;
    if (current >= cap) {
      res.status(429).json({
        error: 'AI_CONCURRENCY_LIMITED',
        message: `Too many concurrent AI requests. Limit: ${cap} in-flight per user.`,
      });
      return;
    }

    inFlight.set(userId, current + 1);

    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      const count = inFlight.get(userId) ?? 0;
      if (count <= 1) {
        inFlight.delete(userId);
      } else {
        inFlight.set(userId, count - 1);
      }
    };

    res.on('close', release);
    next();
  };
}

/** Test-only: clear the in-flight counter map between test cases. */
export function __resetAiConcurrencyForTest(): void {
  inFlight.clear();
}
