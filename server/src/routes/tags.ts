import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, ForbiddenError } from '../lib/httpErrors.js';
import { verifyLocationMembership } from '../lib/binAccess.js';

const router = Router();

router.use(authenticate);

// GET /api/tags?location_id=X&q=search&limit=40&offset=0
router.get('/', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string | undefined;
  const searchQuery = req.query.q as string | undefined;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 40, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  if (!locationId) {
    throw new ValidationError('location_id is required');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  const params: unknown[] = [locationId, req.user!.id];
  let havingClause = '';

  if (searchQuery?.trim()) {
    params.push(`%${searchQuery.trim()}%`);
    havingClause = `HAVING jt.value LIKE $${params.length}`;
  }

  const baseQuery = `
    SELECT jt.value AS tag, COUNT(DISTINCT b.id) AS count
    FROM bins b, json_each(b.tags) jt
    WHERE b.location_id = $1
      AND b.deleted_at IS NULL
      AND (b.visibility = 'location' OR b.created_by = $2)
    GROUP BY jt.value
    ${havingClause}`;

  // Count query
  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM (${baseQuery})`,
    params,
  );
  const total = countResult.rows[0]?.total ?? 0;

  // Data query with sort, limit, offset
  params.push(limit, offset);
  const dataResult = await query<{ tag: string; count: number }>(
    `${baseQuery}
     ORDER BY jt.value COLLATE NOCASE ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.json({ results: dataResult.rows, count: total });
}));

export default router;
