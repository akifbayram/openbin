import type { NextFunction, Request, Response } from 'express';
import { query } from '../db.js';
import { ForbiddenError } from '../lib/httpErrors.js';

/**
 * Express middleware that requires the authenticated user to be a global admin.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new ForbiddenError('Admin access required'));
    return;
  }

  query<{ is_admin: number | boolean }>('SELECT is_admin FROM users WHERE id = $1', [req.user.id])
    .then(result => {
      const isAdmin = result.rows[0]?.is_admin;
      if (isAdmin !== 1 && isAdmin !== true) {
        next(new ForbiddenError('Admin access required'));
        return;
      }
      next();
    })
    .catch(next);
}
