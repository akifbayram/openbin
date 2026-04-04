import type { NextFunction, Request, Response } from 'express';
import { config, isDemoUser } from '../lib/config.js';

/**
 * Middleware that blocks demo users from performing an action.
 * Returns 403 with a clear message. Non-demo users pass through.
 * Only active when DEMO_MODE=true.
 */
export function blockDemoUser(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (config.demoMode && isDemoUser(req)) {
      res.status(403).json({
        error: 'DEMO_RESTRICTION',
        message: `Demo accounts cannot ${action}`,
      });
      return;
    }
    next();
  };
}
