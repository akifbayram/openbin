import crypto from 'node:crypto';
import { Router } from 'express';
import { generateUuid, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdmin, verifyBinAccess } from '../lib/binAccess.js';
import { config } from '../lib/config.js';
import { NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { logRouteActivity } from '../lib/routeHelpers.js';
import { authenticate } from '../middleware/auth.js';
import { requirePro } from '../middleware/requirePlan.js';

const router = Router();

router.use(authenticate);

// POST /api/bins/:id/share — create or return existing share link
router.post('/:id/share', requirePro(), asyncHandler(async (req, res) => {
  const binId = req.params.id;
  const userId = req.user!.id;

  const access = await verifyBinAccess(binId, userId);
  if (!access) throw new NotFoundError('Bin not found');
  if (access.visibility === 'private') throw new ValidationError('Private bins cannot be shared');

  await requireAdmin(access.locationId, userId, 'share bins');

  const { visibility } = req.body;
  if (visibility && visibility !== 'public' && visibility !== 'unlisted') {
    throw new ValidationError('visibility must be "public" or "unlisted"');
  }

  // Return existing active share if one exists
  const existing = await query(
    'SELECT id, token, visibility, view_count, created_at FROM bin_shares WHERE bin_id = $1 AND revoked_at IS NULL',
    [binId],
  );
  if (existing.rows.length > 0) {
    const share = existing.rows[0];
    const url = config.baseUrl ? `${config.baseUrl}/s/${share.token}` : null;
    res.json({ id: share.id, token: share.token, visibility: share.visibility, url, viewCount: share.view_count, createdAt: share.created_at });
    return;
  }

  const id = generateUuid();
  const token = crypto.randomBytes(16).toString('hex');
  const vis = visibility || 'unlisted';

  await query(
    'INSERT INTO bin_shares (id, bin_id, token, visibility, created_by) VALUES ($1, $2, $3, $4, $5)',
    [id, binId, token, vis, userId],
  );

  logRouteActivity(req, {
    locationId: access.locationId,
    action: 'share_created',
    entityType: 'bin',
    entityId: binId,
  });

  const url = config.baseUrl ? `${config.baseUrl}/s/${token}` : null;
  res.status(201).json({ id, token, visibility: vis, url, viewCount: 0, createdAt: new Date().toISOString() });
}));

// DELETE /api/bins/:id/share — revoke the share link
router.delete('/:id/share', asyncHandler(async (req, res) => {
  const binId = req.params.id;
  const userId = req.user!.id;

  const access = await verifyBinAccess(binId, userId);
  if (!access) throw new NotFoundError('Bin not found');

  await requireAdmin(access.locationId, userId, 'revoke share links');

  const result = await query(
    "UPDATE bin_shares SET revoked_at = datetime('now') WHERE bin_id = $1 AND revoked_at IS NULL",
    [binId],
  );

  if (result.rowCount === 0) throw new NotFoundError('No active share link for this bin');

  logRouteActivity(req, {
    locationId: access.locationId,
    action: 'share_revoked',
    entityType: 'bin',
    entityId: binId,
  });

  res.json({ message: 'Share link revoked' });
}));

// GET /api/bins/:id/share — get share info for a bin
router.get('/:id/share', asyncHandler(async (req, res) => {
  const binId = req.params.id;
  const userId = req.user!.id;

  const access = await verifyBinAccess(binId, userId);
  if (!access) throw new NotFoundError('Bin not found');

  const result = await query(
    'SELECT id, token, visibility, view_count, created_at FROM bin_shares WHERE bin_id = $1 AND revoked_at IS NULL',
    [binId],
  );

  if (result.rows.length === 0) throw new NotFoundError('No active share link for this bin');

  const share = result.rows[0];
  const url = config.baseUrl ? `${config.baseUrl}/s/${share.token}` : null;
  res.json({ id: share.id, token: share.token, visibility: share.visibility, url, viewCount: share.view_count, createdAt: share.created_at });
}));

export { router as binSharesRoutes };
