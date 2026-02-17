import { Router } from 'express';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { enforceCountLimit } from '../lib/countLimiter.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, NotFoundError } from '../lib/httpErrors.js';

const router = Router();

router.use(authenticate);

const MAX_VIEWS = 10;

// GET /api/saved-views
router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, search_query, sort, filters, created_at
     FROM saved_views
     WHERE user_id = $1
     ORDER BY created_at`,
    [req.user!.id]
  );

  res.json({ results: result.rows, count: result.rowCount });
}));

// POST /api/saved-views
router.post('/', asyncHandler(async (req, res) => {
  const { name, search_query, sort, filters } = req.body;

  if (!name || typeof name !== 'string') {
    throw new ValidationError('name is required');
  }

  await enforceCountLimit(
    'saved_views',
    'user_id = $1',
    [req.user!.id],
    MAX_VIEWS,
    'saved views',
  );

  const id = generateUuid();
  const result = await query(
    `INSERT INTO saved_views (id, user_id, name, search_query, sort, filters)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, search_query, sort, filters, created_at`,
    [id, req.user!.id, name, search_query || '', sort || 'updated', JSON.stringify(filters || {})]
  );

  res.status(201).json(result.rows[0]);
}));

// PUT /api/saved-views/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    throw new ValidationError('name is required');
  }

  const result = await query(
    `UPDATE saved_views SET name = $1
     WHERE id = $2 AND user_id = $3
     RETURNING id, name, search_query, sort, filters, created_at`,
    [name, req.params.id, req.user!.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Saved view not found');
  }

  res.json(result.rows[0]);
}));

// DELETE /api/saved-views/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await query(
    'DELETE FROM saved_views WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('Saved view not found');
  }

  res.status(204).end();
}));

export default router;
