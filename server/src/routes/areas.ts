import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

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
    res.json(result.rows);
  } catch (err) {
    console.error('List areas error:', err);
    res.status(500).json({ error: 'Failed to list areas' });
  }
});

// POST /api/locations/:locationId/areas — create area
router.post('/:locationId/areas', requireLocationMember('locationId'), async (req, res) => {
  try {
    const { locationId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Area name is required' });
      return;
    }

    const result = await query(
      `INSERT INTO areas (location_id, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, location_id, name, created_by, created_at, updated_at`,
      [locationId, name.trim(), req.user!.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'An area with this name already exists' });
      return;
    }
    console.error('Create area error:', err);
    res.status(500).json({ error: 'Failed to create area' });
  }
});

// PUT /api/locations/:locationId/areas/:areaId — rename area
router.put('/:locationId/areas/:areaId', requireLocationMember('locationId'), async (req, res) => {
  try {
    const { locationId, areaId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Area name is required' });
      return;
    }

    const result = await query(
      `UPDATE areas SET name = $1, updated_at = now()
       WHERE id = $2 AND location_id = $3
       RETURNING id, location_id, name, created_by, created_at, updated_at`,
      [name.trim(), areaId, locationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Area not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'An area with this name already exists' });
      return;
    }
    console.error('Update area error:', err);
    res.status(500).json({ error: 'Failed to update area' });
  }
});

// DELETE /api/locations/:locationId/areas/:areaId — delete area (bins get area_id = NULL)
router.delete('/:locationId/areas/:areaId', requireLocationMember('locationId'), async (req, res) => {
  try {
    const { locationId, areaId } = req.params;

    const result = await query(
      'DELETE FROM areas WHERE id = $1 AND location_id = $2 RETURNING id',
      [areaId, locationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Area not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete area error:', err);
    res.status(500).json({ error: 'Failed to delete area' });
  }
});

export default router;
