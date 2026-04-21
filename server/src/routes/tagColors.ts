import { Router } from 'express';
import { d, generateUuid, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove, verifyLocationMembership } from '../lib/binAccess.js';
import { COLOR_KEY_REGEX } from '../lib/binValidation.js';
import { ForbiddenError, ValidationError } from '../lib/httpErrors.js';
import { HEX_COLOR_REGEX } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';

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

  // List endpoint returns only the fields consumers actually render (tag + color + parent_tag).
  // Omits id, location_id, created_at, updated_at to keep the payload small — ~15KB → ~4KB at 64 rows.
  // Mutation endpoints below still return the full row for callers that need identifiers.
  const result = await query(
    `SELECT tag, color, parent_tag FROM tag_colors WHERE location_id = $1 ORDER BY tag ${d.nocase()}`,
    [locationId]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

// PUT /api/tag-colors — upsert tag color
router.put('/', asyncHandler(async (req, res) => {
  const { locationId, tag, color, parentTag } = req.body;

  if (!locationId || !tag) {
    throw new ValidationError('locationId and tag are required');
  }

  await requireMemberOrAbove(locationId, req.user!.id, 'manage tag colors');

  if (color && !HEX_COLOR_REGEX.test(color) && !COLOR_KEY_REGEX.test(color)) {
    throw new ValidationError('Color must be a valid hex color or color key');
  }

  const trimmedParent = parentTag?.trim().toLowerCase() || null;

  // Validate parent hierarchy constraints
  if (trimmedParent) {
    if (trimmedParent === tag.trim().toLowerCase()) {
      throw new ValidationError('A tag cannot be its own parent');
    }
    // Parent must not itself be a child (single-level hierarchy)
    const parentEntry = await query<{ parent_tag: string | null }>(
      'SELECT parent_tag FROM tag_colors WHERE location_id = $1 AND tag = $2',
      [locationId, trimmedParent],
    );
    if (parentEntry.rows.length > 0 && parentEntry.rows[0].parent_tag) {
      throw new ValidationError('Cannot set a child tag as parent (single-level hierarchy)');
    }
    // Tag must not already have children
    const children = await query<{ tag: string }>(
      'SELECT tag FROM tag_colors WHERE location_id = $1 AND parent_tag = $2',
      [locationId, tag],
    );
    if (children.rows.length > 0) {
      throw new ValidationError('Cannot set parent on a tag that already has children');
    }
  }

  const effectiveColor = color || '';

  // If color is empty and no parentTag, delete the entry
  if (!effectiveColor && !trimmedParent) {
    await query(
      'DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2',
      [locationId, tag]
    );
    res.json({ deleted: true });
    return;
  }

  const newId = generateUuid();
  const result = await query(
    `INSERT INTO tag_colors (id, location_id, tag, color, parent_tag)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (location_id, tag) DO UPDATE SET color = $4, parent_tag = $5, updated_at = ${d.now()}
     RETURNING id, location_id, tag, color, parent_tag, created_at, updated_at`,
    [newId, locationId, tag, effectiveColor, trimmedParent]
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

  await requireMemberOrAbove(locationId, req.user!.id, 'manage tag colors');

  await query(
    'DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2',
    [locationId, tag]
  );

  res.json({ deleted: true });
}));

export default router;
