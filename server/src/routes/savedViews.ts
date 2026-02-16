import { Router } from 'express';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const MAX_VIEWS = 10;

// GET /api/saved-views
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, search_query, sort, filters, created_at
       FROM saved_views
       WHERE user_id = $1
       ORDER BY created_at`,
      [req.user!.id]
    );

    res.json({ results: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('Get saved views error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get saved views' });
  }
});

// POST /api/saved-views
router.post('/', async (req, res) => {
  try {
    const { name, search_query, sort, filters } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'name is required' });
      return;
    }

    // Check count
    const countResult = await query(
      'SELECT COUNT(*) AS cnt FROM saved_views WHERE user_id = $1',
      [req.user!.id]
    );
    if ((countResult.rows[0] as { cnt: number }).cnt >= MAX_VIEWS) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: `Maximum ${MAX_VIEWS} saved views allowed` });
      return;
    }

    const id = generateUuid();
    const result = await query(
      `INSERT INTO saved_views (id, user_id, name, search_query, sort, filters)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, search_query, sort, filters, created_at`,
      [id, req.user!.id, name, search_query || '', sort || 'updated', JSON.stringify(filters || {})]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create saved view error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create saved view' });
  }
});

// PUT /api/saved-views/:id
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'name is required' });
      return;
    }

    const result = await query(
      `UPDATE saved_views SET name = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, name, search_query, sort, filters, created_at`,
      [name, req.params.id, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Saved view not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update saved view error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update saved view' });
  }
});

// DELETE /api/saved-views/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM saved_views WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Saved view not found' });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error('Delete saved view error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete saved view' });
  }
});

export default router;
