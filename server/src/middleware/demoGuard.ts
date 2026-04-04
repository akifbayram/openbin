import type { NextFunction, Request, Response } from 'express';
import { config, isDemoUser } from '../lib/config.js';

/** Returns 403 for demo users when DEMO_MODE is enabled. */
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
