import type { NextFunction, Request, Response } from 'express';
import { isLocationAdmin, verifyLocationMembership } from '../lib/binAccess.js';

/**
 * Middleware factory to verify user is member of a location.
 * Reads locationId from req.params[paramName] or req.body.locationId or req.query.location_id.
 */
export function requireLocationMember(paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }

    const locationId = req.params[paramName] || req.body?.locationId || req.query.location_id;
    if (!locationId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Location ID required' });
      return;
    }

    if (!await verifyLocationMembership(locationId as string, userId)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    next();
  };
}

/**
 * Middleware factory to verify user is an admin of a location.
 */
export function requireLocationAdmin(paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }

    const locationId = req.params[paramName] || req.body?.locationId || req.query.location_id;
    if (!locationId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Location ID required' });
      return;
    }

    if (!await isLocationAdmin(locationId as string, userId)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Only admins can perform this action' });
      return;
    }

    next();
  };
}

export { isLocationAdmin };
