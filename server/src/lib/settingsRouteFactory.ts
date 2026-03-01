import { Router } from 'express';
import { generateUuid, query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from './asyncHandler.js';
import { ValidationError } from './httpErrors.js';

interface SettingsRouteOptions {
  /** SQLite table name (must have id, user_id, settings, updated_at columns) */
  table: string;
  /** Label used in error messages, e.g. "print settings" */
  label: string;
}

/**
 * Creates a router with GET / PUT endpoints for a per-user JSON blob
 * stored in a table with (id, user_id, settings, updated_at) columns.
 */
export function createSettingsRouter({ table, label: _label }: SettingsRouteOptions): Router {
  const router = Router();
  router.use(authenticate);

  // GET /
  router.get('/', asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT settings FROM ${table} WHERE user_id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.json(null);
      return;
    }

    res.json(result.rows[0].settings);
  }));

  // PUT /
  router.put('/', asyncHandler(async (req, res) => {
    const settings = req.body;

    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      throw new ValidationError('Body must be a JSON object');
    }

    const newId = generateUuid();
    const result = await query(
      `INSERT INTO ${table} (id, user_id, settings)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET settings = $3, updated_at = datetime('now')
       RETURNING settings`,
      [newId, req.user!.id, JSON.stringify(settings)]
    );

    res.json(result.rows[0].settings);
  }));

  return router;
}
