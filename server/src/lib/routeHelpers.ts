import type { Request } from 'express';
import { type LogActivityOptions, logActivity } from './activityLog.js';

type RouteActivityOptions = Omit<LogActivityOptions, 'userId' | 'userName' | 'authMethod' | 'apiKeyId'>;

/**
 * Log an activity entry, auto-filling user/auth fields from the request.
 */
export function logRouteActivity(req: Request, opts: RouteActivityOptions): void {
  logActivity({
    ...opts,
    userId: req.user!.id,
    userName: req.user!.username,
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
  });
}
