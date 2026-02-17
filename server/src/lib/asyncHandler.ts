import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wrap an async route handler so rejected promises are forwarded to next(). */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
