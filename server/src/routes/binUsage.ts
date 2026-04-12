import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { verifyBinAccess } from '../lib/binAccess.js';
import { NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { getUserUsageTrackingPrefs, recordBinUsage } from '../lib/recordBinUsage.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// GET /api/bins/:id/usage
router.get('/:id/usage', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) throw new NotFoundError('Bin not found');

  const result = await query<{ date: string; count: number }>(
    `SELECT date, count FROM bin_usage_days WHERE bin_id = $1 ORDER BY date DESC`,
    [id],
  );

  res.json({ results: result.rows, count: result.rowCount });
}));

// POST /api/bins/:id/usage — record a dot (scan or manual trigger)
router.post('/:id/usage', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const trigger = (req.body?.trigger as string | undefined)?.trim();

  if (trigger !== 'scan' && trigger !== 'manual') {
    throw new ValidationError("trigger must be 'scan' or 'manual'");
  }

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) throw new NotFoundError('Bin not found');

  const prefs = await getUserUsageTrackingPrefs(req.user!.id);
  const enabled = trigger === 'scan' ? prefs.scan : prefs.manual_lookup;

  if (enabled) {
    await recordBinUsage(id, req.user!.id);
    res.status(201).json({ ok: true, recorded: true });
  } else {
    res.json({ ok: true, recorded: false });
  }
}));

export default router;
