import { Router } from 'express';
import { d, query, withTransaction } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove, verifyLocationMembership } from '../lib/binAccess.js';
import { ForbiddenError, ValidationError } from '../lib/httpErrors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// GET /api/tags?location_id=X&q=search&sort=alpha|count&sort_dir=asc|desc&limit=40&offset=0
router.get('/', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string | undefined;
  const searchQuery = req.query.q as string | undefined;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 40, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

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
    FROM bins b, ${d.jsonEachFrom('b.tags', 'jt')}
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

  // Sort
  const sortParam = req.query.sort as string | undefined;
  const orderParam = req.query.sort_dir as string | undefined;
  const desc = orderParam === 'desc';
  const orderBy = sortParam === 'count'
    ? `count ${desc ? 'DESC' : 'ASC'}, jt.value ${d.nocase()} ASC`
    : `jt.value ${d.nocase()} ${desc ? 'DESC' : 'ASC'}`;

  // Data query with sort, limit, offset
  params.push(limit, offset);
  const dataResult = await query<{ tag: string; count: number }>(
    `${baseQuery}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.json({ results: dataResult.rows, count: total });
}));

// PUT /api/tags/rename — rename a tag across all bins in a location
router.put('/rename', asyncHandler(async (req, res) => {
  const { locationId, oldTag, newTag } = req.body;

  if (!locationId || !oldTag || !newTag) {
    throw new ValidationError('locationId, oldTag, and newTag are required');
  }
  if (String(oldTag).length > 100) {
    throw new ValidationError('Tag must be 1-100 characters');
  }

  const trimmed = String(newTag).trim().toLowerCase();
  if (!trimmed || trimmed.length > 100) {
    throw new ValidationError('Tag must be 1-100 characters');
  }
  if (trimmed === String(oldTag).trim().toLowerCase()) {
    res.json({ renamed: true, binsUpdated: 0 });
    return;
  }

  await requireMemberOrAbove(locationId, req.user!.id, 'rename tags');

  const { binsUpdated } = await withTransaction(async (txQuery) => {
    const result = await txQuery<{ updated: number }>(
      `UPDATE bins
       SET tags = (
         SELECT ${d.jsonGroupArray('tag')} FROM (
           SELECT DISTINCT CASE WHEN jt.value = $2 THEN $3 ELSE jt.value END AS tag
           FROM ${d.jsonEachFrom('bins.tags', 'jt')}
         )
       ),
       updated_at = ${d.now()}
       WHERE location_id = $1
         AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM ${d.jsonEachFrom('tags', 'jt2')} WHERE jt2.value = $2)
       RETURNING 1 AS updated`,
      [locationId, oldTag, trimmed],
    );

    await txQuery(
      `UPDATE tag_colors SET tag = $1, updated_at = ${d.now()}
       WHERE location_id = $2 AND tag = $3`,
      [trimmed, locationId, oldTag],
    );

    return { binsUpdated: result.rows.length };
  });

  res.json({ renamed: true, binsUpdated });
}));

// DELETE /api/tags/:tag?location_id=X — remove a tag from all bins in a location
router.delete('/:tag', asyncHandler(async (req, res) => {
  const tag = decodeURIComponent(req.params.tag);
  if (!tag || tag.length > 100) {
    throw new ValidationError('Tag must be 1-100 characters');
  }
  const locationId = req.query.location_id as string;

  if (!locationId) {
    throw new ValidationError('location_id query parameter is required');
  }

  await requireMemberOrAbove(locationId, req.user!.id, 'delete tags');

  const { binsUpdated } = await withTransaction(async (txQuery) => {
    const result = await txQuery<{ updated: number }>(
      `UPDATE bins
       SET tags = (
         SELECT ${d.jsonGroupArray('jt.value')}
         FROM ${d.jsonEachFrom('bins.tags', 'jt')}
         WHERE jt.value != $2
       ),
       updated_at = ${d.now()}
       WHERE location_id = $1
         AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM ${d.jsonEachFrom('tags', 'jt2')} WHERE jt2.value = $2)
       RETURNING 1 AS updated`,
      [locationId, tag],
    );

    await txQuery(
      'DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2',
      [locationId, tag],
    );

    return { binsUpdated: result.rows.length };
  });

  res.json({ deleted: true, binsUpdated });
}));

export default router;
