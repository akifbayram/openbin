import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, ForbiddenError } from '../lib/httpErrors.js';
import { verifyLocationMembership } from '../lib/binAccess.js';

const router = Router();

router.use(authenticate);

// GET /api/items?location_id=X&q=search&sort=alpha|bin&sort_dir=asc|desc&limit=40&offset=0
router.get('/', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string | undefined;
  const searchQuery = req.query.q as string | undefined;
  const sortParam = req.query.sort as string | undefined;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 40, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  if (!locationId) {
    throw new ValidationError('location_id is required');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  const params: unknown[] = [locationId, req.user!.id];
  let whereClause = '';

  if (searchQuery?.trim()) {
    params.push(searchQuery.trim());
    whereClause = `AND (word_match(bi.name, $${params.length}) = 1 OR word_match(b.name, $${params.length}) = 1)`;
  }

  const baseQuery = `
    FROM bin_items bi
    JOIN bins b ON b.id = bi.bin_id
    WHERE b.location_id = $1
      AND b.deleted_at IS NULL
      AND (b.visibility = 'location' OR b.created_by = $2)
      ${whereClause}`;

  // Count query
  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) AS total ${baseQuery}`,
    params,
  );
  const total = countResult.rows[0]?.total ?? 0;

  // Sort
  const orderParam = req.query.sort_dir as string | undefined;
  const desc = orderParam === 'desc';
  const dir = desc ? 'DESC' : 'ASC';
  const orderBy = sortParam === 'bin'
    ? `b.name COLLATE NOCASE ${dir}, bi.name COLLATE NOCASE ${dir}`
    : `bi.name COLLATE NOCASE ${dir}`;

  // Data query
  params.push(limit, offset);
  const dataResult = await query<{
    id: string;
    name: string;
    bin_id: string;
    bin_name: string;
    bin_icon: string;
    bin_color: string;
  }>(
    `SELECT bi.id, bi.name, bi.bin_id, b.name AS bin_name, b.icon AS bin_icon, b.color AS bin_color
     ${baseQuery}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.json({ results: dataResult.rows, count: total });
}));

export default router;
