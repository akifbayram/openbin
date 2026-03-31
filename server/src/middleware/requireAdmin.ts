import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../db.js';
import { ForbiddenError } from '../lib/httpErrors.js';

/**
 * Express middleware that requires the authenticated user to be a global admin.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new ForbiddenError('Admin access required'));
    return;
  }

  const db = getDb();
  const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id) as { is_admin: number } | undefined;
  if (row?.is_admin !== 1) {
    next(new ForbiddenError('Admin access required'));
    return;
  }

  next();
}
