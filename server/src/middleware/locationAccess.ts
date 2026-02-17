import { Request, Response, NextFunction } from 'express';
import { verifyLocationMembership, isLocationOwner } from '../lib/binAccess.js';

/**
 * Middleware factory to verify user is member of a location.
 * Reads locationId from req.params[paramName] or req.body.locationId or req.query.location_id.
 */
export function requireLocationMember(paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const locationId = req.params[paramName] || req.body?.locationId || req.query.location_id;
    if (!locationId) {
      res.status(400).json({ error: 'Location ID required' });
      return;
    }

    if (!await verifyLocationMembership(locationId as string, userId)) {
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    next();
  };
}

export { isLocationOwner };
