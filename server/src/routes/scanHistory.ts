import { Router } from 'express';
import { generateUuid, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError } from '../lib/httpErrors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /api/scan-history?limit=N
router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(
    Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_LIMIT),
    MAX_LIMIT
  );

  const result = await query(
    `SELECT id, bin_id, scanned_at
     FROM scan_history
     WHERE user_id = $1
     ORDER BY scanned_at DESC
     LIMIT $2`,
    [req.user!.id, limit]
  );

  res.json({ results: result.rows, count: result.rowCount });
}));

// POST /api/scan-history
router.post('/', asyncHandler(async (req, res) => {
  const binId = req.body.binId || req.body.bin_id;

  if (!binId || typeof binId !== 'string') {
    throw new ValidationError('binId is required');
  }

  const id = generateUuid();
  await query(
    `INSERT INTO scan_history (id, user_id, bin_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, bin_id) DO UPDATE SET scanned_at = datetime('now')`,
    [id, req.user!.id, binId]
  );

  // Trim old entries beyond MAX_LIMIT
  await query(
    `DELETE FROM scan_history
     WHERE user_id = $1 AND id NOT IN (
       SELECT id FROM scan_history
       WHERE user_id = $1
       ORDER BY scanned_at DESC
       LIMIT $2
     )`,
    [req.user!.id, MAX_LIMIT]
  );

  res.status(201).json({ ok: true });
}));

// DELETE /api/scan-history
router.delete('/', asyncHandler(async (req, res) => {
  await query(
    'DELETE FROM scan_history WHERE user_id = $1',
    [req.user!.id]
  );

  res.status(204).end();
}));

export default router;
