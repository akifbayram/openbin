import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Per-user in-flight cap for AI streaming endpoints. The slot is released on
 * `res.on('close')` — fires for both normal end and client disconnect.
 */
export function createAiConcurrencyLimiter(cap: number): RequestHandler {
  const inFlight = new Map<string, number>();

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
    res.on('close', () => {
      if (released) return;
      released = true;
      const count = inFlight.get(userId) ?? 0;
      if (count <= 1) {
        inFlight.delete(userId);
      } else {
        inFlight.set(userId, count - 1);
      }
    });

    next();
  };
}
