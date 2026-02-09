import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';

/**
 * Middleware factory to verify user is member of a home.
 * Reads homeId from req.params[paramName] or req.body.homeId or req.query.home_id.
 */
export function requireHomeMember(paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const homeId = req.params[paramName] || req.body?.homeId || req.query.home_id;
    if (!homeId) {
      res.status(400).json({ error: 'Home ID required' });
      return;
    }

    const result = await query(
      'SELECT id FROM home_members WHERE home_id = $1 AND user_id = $2',
      [homeId, userId]
    );

    if (result.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    next();
  };
}

/** Check if a user is the owner of a home */
export async function isHomeOwner(homeId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM home_members WHERE home_id = $1 AND user_id = $2 AND role = $3',
    [homeId, userId, 'owner']
  );
  return result.rows.length > 0;
}
