import { Router } from 'express';
import { generateUuid, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { logRouteActivity } from '../lib/routeHelpers.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationAdmin, requireLocationMember } from '../middleware/locationAccess.js';

const router = Router();

router.use(authenticate);

// GET /api/locations/:locationId/areas — list areas for a location
router.get('/:locationId/areas', requireLocationMember('locationId'), asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const result = await query(
    `WITH RECURSIVE
      area_tree AS (
        SELECT id, id AS root_id FROM areas WHERE location_id = $1
        UNION ALL
        SELECT c.id, t.root_id FROM areas c JOIN area_tree t ON c.parent_id = t.id
      ),
      desc_counts AS (
        SELECT t.root_id, COUNT(b.id) AS cnt
        FROM area_tree t
        LEFT JOIN bins b ON b.area_id = t.id AND b.deleted_at IS NULL
        GROUP BY t.root_id
      )
    SELECT a.id, a.location_id, a.name, a.parent_id, a.created_by, a.created_at, a.updated_at,
      (SELECT COUNT(*) FROM bins WHERE area_id = a.id AND deleted_at IS NULL) AS bin_count,
      COALESCE(dc.cnt, 0) AS descendant_bin_count
    FROM areas a
    LEFT JOIN desc_counts dc ON dc.root_id = a.id
    WHERE a.location_id = $1
    ORDER BY a.name COLLATE NOCASE`,
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
  const { name, parent_id } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Area name is required');
  }

  const resolvedParentId = parent_id || null;

  // Validate parent_id if provided
  if (resolvedParentId) {
    const parentResult = await query(
      'SELECT id FROM areas WHERE id = $1 AND location_id = $2',
      [resolvedParentId, locationId]
    );
    if (parentResult.rows.length === 0) {
      throw new ValidationError('Parent area not found in this location');
    }
  }

  // Check for duplicate sibling name (SQLite UNIQUE treats NULLs as distinct, so check manually for root areas)
  const dupQuery = resolvedParentId
    ? 'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id = $3'
    : 'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id IS NULL';
  const dupParams = resolvedParentId ? [locationId, name.trim(), resolvedParentId] : [locationId, name.trim()];
  const dupResult = await query(dupQuery, dupParams);
  if (dupResult.rows.length > 0) {
    throw new ConflictError('An area with this name already exists');
  }

  try {
    const result = await query(
      `INSERT INTO areas (id, location_id, name, parent_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, location_id, name, parent_id, created_by, created_at, updated_at`,
      [generateUuid(), locationId, name.trim(), resolvedParentId, req.user!.id]
    );

    const area = result.rows[0];

    logRouteActivity(req, {
      locationId,
      action: 'create',
      entityType: 'area',
      entityId: area.id,
      entityName: area.name,
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
       RETURNING id, location_id, name, parent_id, created_by, created_at, updated_at`,
      [name.trim(), areaId, locationId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Area not found');
    }

    const area = result.rows[0];

    if (oldName && oldName !== name.trim()) {
      logRouteActivity(req, {
        locationId,
        action: 'update',
        entityType: 'area',
        entityId: areaId,
        entityName: area.name,
        changes: { name: { old: oldName, new: name.trim() } },
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

  // Count descendant areas and bins for informational response
  const descendantInfo = await query(
    `WITH RECURSIVE subtree AS (
      SELECT id FROM areas WHERE id = $1
      UNION ALL
      SELECT c.id FROM areas c JOIN subtree s ON c.parent_id = s.id
    )
    SELECT
      (SELECT COUNT(*) - 1 FROM subtree) AS descendant_area_count,
      (SELECT COUNT(*) FROM bins WHERE area_id IN (SELECT id FROM subtree) AND deleted_at IS NULL) AS descendant_bin_count`,
    [areaId]
  );

  const result = await query(
    'DELETE FROM areas WHERE id = $1 AND location_id = $2 RETURNING id',
    [areaId, locationId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Area not found');
  }

  logRouteActivity(req, {
    locationId,
    action: 'delete',
    entityType: 'area',
    entityId: areaId,
    entityName: areaName,
  });

  const info = descendantInfo.rows[0] ?? {};
  res.json({
    message: 'Area deleted',
    descendant_area_count: info.descendant_area_count ?? 0,
    descendant_bin_count: info.descendant_bin_count ?? 0,
  });
}));

export default router;
