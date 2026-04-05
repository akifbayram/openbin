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

  // Tags used on bins
  const binTagsQuery = `
    SELECT jt.value AS tag, COUNT(DISTINCT b.id) AS count
    FROM bins b, ${d.jsonEachFrom('b.tags', 'jt')}
    WHERE b.location_id = $1
      AND b.deleted_at IS NULL
      AND (b.visibility = 'location' OR b.created_by = $2)
    GROUP BY jt.value
    ${havingClause}`;

  // Parent tags that have children but are not used on any bin (so the tree is visible)
  const parentOnlyQuery = `
    SELECT DISTINCT tc_p.parent_tag AS tag, 0 AS count
    FROM tag_colors tc_p
    WHERE tc_p.location_id = $1
      AND tc_p.parent_tag IS NOT NULL
      ${searchQuery?.trim() ? `AND tc_p.parent_tag LIKE $${params.length}` : ''}
      AND tc_p.parent_tag NOT IN (
        SELECT jt2.value FROM bins b2, ${d.jsonEachFrom('b2.tags', 'jt2')}
        WHERE b2.location_id = $1 AND b2.deleted_at IS NULL
      )`;

  const combinedQuery = `${binTagsQuery} UNION ALL ${parentOnlyQuery}`;

  // Count query
  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM (${combinedQuery}) _u`,
    params,
  );
  const total = countResult.rows[0]?.total ?? 0;

  // Sort
  const sortParam = req.query.sort as string | undefined;
  const orderParam = req.query.sort_dir as string | undefined;
  const desc = orderParam === 'desc';
  const orderBy = sortParam === 'count'
    ? `count ${desc ? 'DESC' : 'ASC'}, t.tag ${d.nocase()} ASC`
    : `t.tag ${d.nocase()} ${desc ? 'DESC' : 'ASC'}`;

  // Data query with LEFT JOIN for parent_tag
  const baseQuery = `
    SELECT t.tag, t.count, tc.parent_tag
    FROM (${combinedQuery}) t
    LEFT JOIN tag_colors tc ON tc.tag = t.tag AND tc.location_id = $1`;

  params.push(limit, offset);
  const dataResult = await query<{ tag: string; count: number; parent_tag: string | null }>(
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

    // Update parent_tag references in children
    await txQuery(
      `UPDATE tag_colors SET parent_tag = $1, updated_at = ${d.now()}
       WHERE location_id = $2 AND parent_tag = $3`,
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

  const { binsUpdated, orphanedChildren } = await withTransaction(async (txQuery) => {
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

    // Orphan children — set their parent_tag to NULL
    const orphaned = await txQuery<{ tag: string }>(
      `UPDATE tag_colors SET parent_tag = NULL, updated_at = ${d.now()}
       WHERE location_id = $1 AND parent_tag = $2
       RETURNING tag`,
      [locationId, tag],
    );

    await txQuery(
      'DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2',
      [locationId, tag],
    );

    return { binsUpdated: result.rows.length, orphanedChildren: orphaned.rows.length };
  });

  res.json({ deleted: true, binsUpdated, orphanedChildren });
}));

export default router;
