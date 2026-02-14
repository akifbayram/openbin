import { Router } from 'express';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';
import { logActivity } from '../lib/activityLog.js';

const router = Router();

router.use(authenticate);

// GET /api/locations/:locationId/areas — list areas for a location
router.get('/:locationId/areas', requireLocationMember('locationId'), async (req, res) => {
  try {
    const { locationId } = req.params;
    const result = await query(
      'SELECT id, location_id, name, created_by, created_at, updated_at FROM areas WHERE location_id = $1 ORDER BY name',
      [locationId]
    );
    res.json({ results: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('List areas error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list areas' });
  }
});

// POST /api/locations/:locationId/areas — create area
router.post('/:locationId/areas', requireLocationMember('locationId'), async (req, res) => {
  try {
    const { locationId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Area name is required' });
      return;
    }

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
    });

    res.status(201).json(area);
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'CONFLICT', message: 'An area with this name already exists' });
      return;
    }
    console.error('Create area error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create area' });
  }
});

// PUT /api/locations/:locationId/areas/:areaId — rename area
router.put('/:locationId/areas/:areaId', requireLocationMember('locationId'), async (req, res) => {
  try {
    const { locationId, areaId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Area name is required' });
      return;
    }

    // Get old name for activity log
    const oldResult = await query('SELECT name FROM areas WHERE id = $1 AND location_id = $2', [areaId, locationId]);
    const oldName = oldResult.rows[0]?.name;

    const result = await query(
      `UPDATE areas SET name = $1, updated_at = datetime('now')
       WHERE id = $2 AND location_id = $3
       RETURNING id, location_id, name, created_by, created_at, updated_at`,
      [name.trim(), areaId, locationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Area not found' });
      return;
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
      });
    }

    res.json(area);
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'CONFLICT', message: 'An area with this name already exists' });
      return;
    }
    console.error('Update area error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update area' });
  }
});

// DELETE /api/locations/:locationId/areas/:areaId — delete area (bins get area_id = NULL)
router.delete('/:locationId/areas/:areaId', requireLocationMember('locationId'), async (req, res) => {
  try {
    const { locationId, areaId } = req.params;

    // Get name for activity log
    const nameResult = await query('SELECT name FROM areas WHERE id = $1 AND location_id = $2', [areaId, locationId]);
    const areaName = nameResult.rows[0]?.name;

    const result = await query(
      'DELETE FROM areas WHERE id = $1 AND location_id = $2 RETURNING id',
      [areaId, locationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Area not found' });
      return;
    }

    logActivity({
      locationId,
      userId: req.user!.id,
      userName: req.user!.username,
      action: 'delete',
      entityType: 'area',
      entityId: areaId,
      entityName: areaName,
    });

    res.json({ message: 'Area deleted' });
  } catch (err) {
    console.error('Delete area error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete area' });
  }
});

export default router;
