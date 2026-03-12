import { Router } from 'express';
import { getDb, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove, verifyBinAccess, verifyLocationMembership } from '../lib/binAccess.js';
import { BIN_SELECT_COLS } from '../lib/binQueries.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// GET /api/bins/pinned — list pinned bins for current user
router.get('/pinned', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string | undefined;
  if (!locationId) {
    throw new ValidationError('location_id query parameter is required');
  }
  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }
  const result = await query(
    `SELECT ${BIN_SELECT_COLS}, 1 AS is_pinned
     FROM pinned_bins pb
     JOIN bins b ON b.id = pb.bin_id
     LEFT JOIN areas a ON a.id = b.area_id
     WHERE pb.user_id = $1 AND b.location_id = $2 AND b.deleted_at IS NULL AND (b.visibility = 'location' OR b.created_by = $1)
     ORDER BY pb.position`,
    [req.user!.id, locationId]
  );
  res.json({ results: result.rows, count: result.rows.length });
}));

// PUT /api/bins/pinned/reorder — update pin positions
router.put('/pinned/reorder', asyncHandler(async (req, res) => {
  const { bin_ids } = req.body;
  if (!Array.isArray(bin_ids) || bin_ids.length === 0) {
    throw new ValidationError('bin_ids array is required');
  }
  const db = getDb();
  const stmt = db.prepare('UPDATE pinned_bins SET position = ? WHERE user_id = ? AND bin_id = ?');
  const updateAll = db.transaction(() => {
    for (let i = 0; i < bin_ids.length; i++) {
      stmt.run(i, req.user!.id, bin_ids[i]);
    }
  });
  updateAll();
  res.json({ success: true });
}));

// POST /api/bins/:id/pin — pin a bin
router.post('/:id/pin', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  await requireMemberOrAbove(access.locationId, req.user!.id, 'pin bins');

  // Check pin count limit per location
  const countResult = await query(
    `SELECT COUNT(*) as cnt FROM pinned_bins pb
     JOIN bins b ON b.id = pb.bin_id
     WHERE pb.user_id = $1 AND b.location_id = $2`,
    [req.user!.id, access.locationId]
  );
  if (countResult.rows[0].cnt >= 20) {
    throw new ValidationError('Maximum 20 pinned bins per location');
  }

  // Get max position
  const maxResult = await query(
    'SELECT COALESCE(MAX(position), -1) as max_pos FROM pinned_bins WHERE user_id = $1',
    [req.user!.id]
  );
  const nextPos = maxResult.rows[0].max_pos + 1;

  await query(
    'INSERT OR IGNORE INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, $3)',
    [req.user!.id, id, nextPos]
  );

  res.json({ pinned: true });
}));

// DELETE /api/bins/:id/pin — unpin a bin
router.delete('/:id/pin', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query(
    'DELETE FROM pinned_bins WHERE user_id = $1 AND bin_id = $2',
    [req.user!.id, id]
  );
  res.json({ pinned: false });
}));

export default router;
