import type { NextFunction, Request, Response } from 'express';
import { query } from '../db.js';

let maintenanceMode = false;
let maintenanceMessage = 'System is undergoing maintenance. Please try again later.';

/** Check if maintenance mode is active (cached in-memory). */
export function isMaintenanceMode(): boolean {
  return maintenanceMode;
}

export function getMaintenanceMessage(): string {
  return maintenanceMessage;
}

/** Set maintenance mode. Called by admin system routes. */
export function setMaintenanceMode(enabled: boolean, message?: string): void {
  maintenanceMode = enabled;
  if (message) maintenanceMessage = message;
}

/** Load maintenance mode state from DB on startup. */
export async function loadMaintenanceMode(): Promise<void> {
  try {
    const result = await query<{ value: string }>("SELECT value FROM settings WHERE key = 'maintenance_mode'");
    if (result.rows.length > 0) {
      const data = JSON.parse(result.rows[0].value);
      maintenanceMode = data.enabled === true;
      if (data.message) maintenanceMessage = data.message;
    }
  } catch {
    // ignore — settings table may not exist yet
  }
}

/**
 * Express middleware that returns 503 for non-admin requests when maintenance mode is on.
 * Admin routes (/api/admin/*) and auth status are always allowed through.
 */
export function maintenanceGate(req: Request, res: Response, next: NextFunction): void {
  if (!maintenanceMode) {
    next();
    return;
  }

  // Always allow: admin routes, auth endpoints (login/refresh/logout), health check
  const path = req.path;
  if (path.startsWith('/admin') || path.startsWith('/auth/') || path === '/health') {
    next();
    return;
  }

  // Allow admins through (if already authenticated via tryAuthenticate)
  if (req.user) {
    // Quick check — the requireAdmin middleware does a DB lookup,
    // but here we just trust tryAuthenticate + a lightweight check.
    // Admin users are rare, so we do a fast query.
    query<{ is_admin: number | boolean }>('SELECT is_admin FROM users WHERE id = $1', [req.user.id])
      .then((result) => {
        const isAdmin = result.rows[0]?.is_admin;
        if (isAdmin === 1 || isAdmin === true) {
          next();
        } else {
          res.status(503).json({
            error: 'MAINTENANCE',
            message: maintenanceMessage,
          });
        }
      })
      .catch(() => {
        res.status(503).json({ error: 'MAINTENANCE', message: maintenanceMessage });
      });
    return;
  }

  res.status(503).json({
    error: 'MAINTENANCE',
    message: maintenanceMessage,
  });
}
