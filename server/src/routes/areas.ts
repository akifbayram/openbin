import { Router } from 'express';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember, requireLocationAdmin } from '../middleware/locationAccess.js';
import { logActivity } from '../lib/activityLog.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, NotFoundError, ConflictError } from '../lib/httpErrors.js';

const router = Router();

router.use(authenticate);

// GET /api/locations/:locationId/areas — list areas for a location
router.get('/:locationId/areas', requireLocationMember('locationId'), asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const result = await query(
    `SELECT a.id, a.location_id, a.name, a.created_by, a.created_at, a.updated_at,
            (SELECT COUNT(*) FROM bins WHERE area_id = a.id AND deleted_at IS NULL AND location_id = a.location_id) AS bin_count
     FROM areas a
     WHERE a.location_id = $1
     ORDER BY a.name`,
    [locationId]
  );
  const unassignedResult = await query(
    'SELECT COUNT(*) AS cnt FROM bins WHERE location_id = $1 AND area_id IS NULL AND deleted_at IS NULL',
    [locationId]
  );
  res.json({ results: result.rows, count: result.rows.length, unassigned_count: unassignedResult.rows[0]?.cnt ?? 0 });
}));

// POST /api/locations/:locationId/areas — create area (admin only)
router.post('/:locationId/areas', requireLocationAdmin('locationId'), asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Area name is required');
  }

  try {
    const result = await query(
      `INSERT INTO areas (id, location_id, name, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, location_id, name, created_by, created_at, updated_at`,
      [generateUuid(), locationId, name.trim(), req.user!.id]
    );

    const area = result.rows[0];

    logActivity({
      locationId,
      userId: req.user!.id,
      userName: req.user!.username,
      action: 'create',
      entityType: 'area',
      entityId: area.id,
      entityName: area.name,
      authMethod: req.authMethod,
      apiKeyId: req.apiKeyId,
    });

    res.status(201).json(area);
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ConflictError('An area with this name already exists');
    }
    throw err;
  }
}));

// PUT /api/locations/:locationId/areas/:areaId — rename area (admin only)
router.put('/:locationId/areas/:areaId', requireLocationAdmin('locationId'), asyncHandler(async (req, res) => {
  const { locationId, areaId } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Area name is required');
  }

  // Get old name for activity log
  const oldResult = await query('SELECT name FROM areas WHERE id = $1 AND location_id = $2', [areaId, locationId]);
  const oldName = oldResult.rows[0]?.name;

  try {
    const result = await query(
      `UPDATE areas SET name = $1, updated_at = datetime('now')
       WHERE id = $2 AND location_id = $3
       RETURNING id, location_id, name, created_by, created_at, updated_at`,
      [name.trim(), areaId, locationId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Area not found');
    }

    const area = result.rows[0];

    if (oldName && oldName !== name.trim()) {
      logActivity({
        locationId,
        userId: req.user!.id,
        userName: req.user!.username,
        action: 'update',
        entityType: 'area',
        entityId: areaId,
        entityName: area.name,
        changes: { name: { old: oldName, new: name.trim() } },
        authMethod: req.authMethod,
      });
    }

    res.json(area);
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ConflictError('An area with this name already exists');
    }
    throw err;
  }
}));

// DELETE /api/locations/:locationId/areas/:areaId — delete area (admin only, bins get area_id = NULL)
router.delete('/:locationId/areas/:areaId', requireLocationAdmin('locationId'), asyncHandler(async (req, res) => {
  const { locationId, areaId } = req.params;

  // Get name for activity log
  const nameResult = await query('SELECT name FROM areas WHERE id = $1 AND location_id = $2', [areaId, locationId]);
  const areaName = nameResult.rows[0]?.name;

  const result = await query(
    'DELETE FROM areas WHERE id = $1 AND location_id = $2 RETURNING id',
    [areaId, locationId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Area not found');
  }

  logActivity({
    locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'delete',
    entityType: 'area',
    entityId: areaId,
    entityName: areaName,
    authMethod: req.authMethod,
  });

  res.json({ message: 'Area deleted' });
}));

export default router;
