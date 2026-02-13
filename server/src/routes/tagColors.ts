import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

async function verifyLocationMembership(locationId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/tag-colors?location_id=X — list all tag colors for a location
router.get('/', async (req, res) => {
  try {
    const locationId = req.query.location_id as string;
    if (!locationId) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'location_id query parameter is required' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    const result = await query(
      'SELECT id, location_id, tag, color, created_at, updated_at FROM tag_colors WHERE location_id = $1 ORDER BY tag',
      [locationId]
    );

    res.json({ results: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('List tag colors error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list tag colors' });
  }
});

// PUT /api/tag-colors — upsert tag color
router.put('/', async (req, res) => {
  try {
    const { locationId, tag, color } = req.body;

    if (!locationId || !tag) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'locationId and tag are required' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
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

    const result = await query(
      `INSERT INTO tag_colors (location_id, tag, color)
       VALUES ($1, $2, $3)
       ON CONFLICT (location_id, tag) DO UPDATE SET color = $3, updated_at = now()
       RETURNING id, location_id, tag, color, created_at, updated_at`,
      [locationId, tag, color]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Upsert tag color error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to upsert tag color' });
  }
});

// DELETE /api/tag-colors/:tag?location_id=X — remove a tag color
router.delete('/:tag', async (req, res) => {
  try {
    const tag = req.params.tag;
    const locationId = req.query.location_id as string;

    if (!locationId) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'location_id query parameter is required' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    await query(
      'DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2',
      [locationId, tag]
    );

    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete tag color error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete tag color' });
  }
});

export default router;
