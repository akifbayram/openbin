import { Router } from 'express';
import { generateUuid, getDb, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdmin, verifyLocationMembership } from '../lib/binAccess.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { assertLocationWritable } from '../lib/planGate.js';
import { validateRequiredString } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';
import { requirePro } from '../middleware/requirePlan.js';

const router = Router();
router.use(authenticate);

// GET /api/locations/:locationId/custom-fields
router.get('/:locationId/custom-fields', asyncHandler(async (req, res) => {
  const { locationId } = req.params;

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  const result = await query(
    'SELECT id, location_id, name, position, created_at, updated_at FROM location_custom_fields WHERE location_id = $1 ORDER BY position, created_at',
    [locationId],
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

// POST /api/locations/:locationId/custom-fields
router.post('/:locationId/custom-fields', requirePro(), asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { name } = req.body;

  await assertLocationWritable(locationId);

  await requireAdmin(locationId, req.user!.id, 'manage custom fields');

  const trimmedName = validateRequiredString(name, 'name');
  if (trimmedName.length > 100) {
    throw new ValidationError('Field name too long (max 100 characters)');
  }

  // Get next position
  const maxResult = await query(
    'SELECT COALESCE(MAX(position), -1) as max_pos FROM location_custom_fields WHERE location_id = $1',
    [locationId],
  );
  const nextPos = (maxResult.rows[0] as { max_pos: number }).max_pos + 1;

  const id = generateUuid();
  await query(
    `INSERT INTO location_custom_fields (id, location_id, name, position) VALUES ($1, $2, $3, $4)`,
    [id, locationId, trimmedName, nextPos],
  );

  const result = await query(
    'SELECT id, location_id, name, position, created_at, updated_at FROM location_custom_fields WHERE id = $1',
    [id],
  );

  res.status(201).json(result.rows[0]);
}));

// PUT /api/locations/:locationId/custom-fields/reorder (before :fieldId to avoid param capture)
router.put('/:locationId/custom-fields/reorder', requirePro(), asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { field_ids } = req.body;

  await assertLocationWritable(locationId);

  await requireAdmin(locationId, req.user!.id, 'manage custom fields');

  if (!Array.isArray(field_ids) || field_ids.length === 0) {
    throw new ValidationError('field_ids array is required');
  }

  const db = getDb();
  const stmt = db.prepare(
    `UPDATE location_custom_fields SET position = ?, updated_at = datetime('now') WHERE id = ? AND location_id = ?`,
  );
  db.transaction(() => {
    for (let i = 0; i < field_ids.length; i++) {
      stmt.run(i, field_ids[i], locationId);
    }
  })();

  res.json({ success: true });
}));

// PUT /api/locations/:locationId/custom-fields/:fieldId
router.put('/:locationId/custom-fields/:fieldId', requirePro(), asyncHandler(async (req, res) => {
  const { locationId, fieldId } = req.params;
  const { name, position } = req.body;

  await assertLocationWritable(locationId);

  await requireAdmin(locationId, req.user!.id, 'manage custom fields');

  const existing = await query(
    'SELECT id FROM location_custom_fields WHERE id = $1 AND location_id = $2',
    [fieldId, locationId],
  );
  if (existing.rows.length === 0) {
    throw new NotFoundError('Custom field not found');
  }

  const setClauses: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];
  let idx = 1;

  if (name !== undefined) {
    const trimmedName = validateRequiredString(name, 'name');
    if (trimmedName.length > 100) {
      throw new ValidationError('Field name too long (max 100 characters)');
    }
    setClauses.push(`name = $${idx++}`);
    params.push(trimmedName);
  }
  if (position !== undefined) {
    if (typeof position !== 'number' || position < 0) {
      throw new ValidationError('position must be a non-negative number');
    }
    setClauses.push(`position = $${idx++}`);
    params.push(position);
  }

  params.push(fieldId);
  await query(
    `UPDATE location_custom_fields SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    params,
  );

  const result = await query(
    'SELECT id, location_id, name, position, created_at, updated_at FROM location_custom_fields WHERE id = $1',
    [fieldId],
  );

  res.json(result.rows[0]);
}));

// DELETE /api/locations/:locationId/custom-fields/:fieldId
router.delete('/:locationId/custom-fields/:fieldId', requirePro(), asyncHandler(async (req, res) => {
  const { locationId, fieldId } = req.params;

  await assertLocationWritable(locationId);

  await requireAdmin(locationId, req.user!.id, 'manage custom fields');

  const existing = await query(
    'SELECT id FROM location_custom_fields WHERE id = $1 AND location_id = $2',
    [fieldId, locationId],
  );
  if (existing.rows.length === 0) {
    throw new NotFoundError('Custom field not found');
  }

  // CASCADE deletes all bin_custom_field_values for this field
  await query('DELETE FROM location_custom_fields WHERE id = $1', [fieldId]);

  res.status(204).end();
}));

export default router;
