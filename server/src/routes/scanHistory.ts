import { Router } from 'express';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /api/scan-history?limit=N
router.get('/', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('Get scan history error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get scan history' });
  }
});

// POST /api/scan-history
router.post('/', async (req, res) => {
  try {
    const binId = req.body.binId || req.body.bin_id;

    if (!binId || typeof binId !== 'string') {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'binId is required' });
      return;
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
  } catch (err) {
    console.error('Record scan error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to record scan' });
  }
});

// DELETE /api/scan-history
router.delete('/', async (req, res) => {
  try {
    await query(
      'DELETE FROM scan_history WHERE user_id = $1',
      [req.user!.id]
    );

    res.status(204).end();
  } catch (err) {
    console.error('Clear scan history error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to clear scan history' });
  }
});

export default router;
