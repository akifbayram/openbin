import { Router } from 'express';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, ForbiddenError } from '../lib/httpErrors.js';
import { verifyLocationMembership } from '../lib/binAccess.js';

const router = Router();

router.use(authenticate);

// GET /api/tag-colors?location_id=X — list all tag colors for a location
router.get('/', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string;
  if (!locationId) {
    throw new ValidationError('location_id query parameter is required');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  const result = await query(
    'SELECT id, location_id, tag, color, created_at, updated_at FROM tag_colors WHERE location_id = $1 ORDER BY tag',
    [locationId]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

// PUT /api/tag-colors — upsert tag color
router.put('/', asyncHandler(async (req, res) => {
  const { locationId, tag, color } = req.body;

  if (!locationId || !tag) {
    throw new ValidationError('locationId and tag are required');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  // If color is empty, remove the tag color
  if (!color) {
    await query(
      'DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2',
      [locationId, tag]
    );
    res.json({ deleted: true });
    return;
  }

  const newId = generateUuid();
  const result = await query(
    `INSERT INTO tag_colors (id, location_id, tag, color)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (location_id, tag) DO UPDATE SET color = $4, updated_at = datetime('now')
     RETURNING id, location_id, tag, color, created_at, updated_at`,
    [newId, locationId, tag, color]
  );

  res.json(result.rows[0]);
}));

// DELETE /api/tag-colors/:tag?location_id=X — remove a tag color
router.delete('/:tag', asyncHandler(async (req, res) => {
  const tag = req.params.tag;
  const locationId = req.query.location_id as string;

  if (!locationId) {
    throw new ValidationError('location_id query parameter is required');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  await query(
    'DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2',
    [locationId, tag]
  );

  res.json({ deleted: true });
}));

export default router;
