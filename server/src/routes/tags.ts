import { Router } from 'express';
import { d, generateUuid, query, withTransaction } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove, verifyLocationMembership } from '../lib/binAccess.js';
import { ForbiddenError, HttpError, ValidationError } from '../lib/httpErrors.js';
import { logRouteActivity } from '../lib/routeHelpers.js';
import { authenticate } from '../middleware/auth.js';

const TAG_REGEX = /^[a-z0-9][a-z0-9-]{0,99}$/;
const MAX_BINS_PER_APPLY = 500;

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

  // Tags from tag_colors not present on any bin (standalone or parent-only)
  const colorOnlyQuery = `
    SELECT DISTINCT t_all.tag, 0 AS count FROM (
      SELECT tc.tag FROM tag_colors tc WHERE tc.location_id = $1
      UNION
      SELECT tc2.parent_tag FROM tag_colors tc2
        WHERE tc2.location_id = $1 AND tc2.parent_tag IS NOT NULL
    ) t_all
    WHERE t_all.tag NOT IN (
      SELECT jt2.value FROM bins b2, ${d.jsonEachFrom('b2.tags', 'jt2')}
      WHERE b2.location_id = $1 AND b2.deleted_at IS NULL
        AND (b2.visibility = 'location' OR b2.created_by = $2)
    )
    ${searchQuery?.trim() ? `AND t_all.tag LIKE $${params.length}` : ''}`;

  const combinedQuery = `${binTagsQuery} UNION ALL ${colorOnlyQuery}`;

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

// POST /api/tags/bulk-apply — apply AI tag suggestions (taxonomy + per-bin assignments)
router.post('/bulk-apply', asyncHandler(async (req, res) => {
  const { locationId, taxonomy, assignments } = req.body ?? {};
  if (!locationId || typeof locationId !== 'string') throw new ValidationError('locationId is required');
  if (!taxonomy || typeof taxonomy !== 'object') throw new ValidationError('taxonomy is required');
  if (!assignments || typeof assignments !== 'object') throw new ValidationError('assignments is required');

  const newTags: Array<{ tag: string; parent?: string | null }> = Array.isArray(taxonomy.newTags) ? taxonomy.newTags : [];
  const renames: Array<{ from: string; to: string }> = Array.isArray(taxonomy.renames) ? taxonomy.renames : [];
  const merges: Array<{ from: string[]; to: string }> = Array.isArray(taxonomy.merges) ? taxonomy.merges : [];
  const parents: Array<{ tag: string; parent: string | null }> = Array.isArray(taxonomy.parents) ? taxonomy.parents : [];
  const adds: Record<string, string[]> = (assignments.add && typeof assignments.add === 'object') ? assignments.add : {};
  const removes: Record<string, string[]> = (assignments.remove && typeof assignments.remove === 'object') ? assignments.remove : {};

  const validateTag = (t: unknown): t is string => typeof t === 'string' && TAG_REGEX.test(t);
  for (const n of newTags) {
    if (!validateTag(n?.tag)) throw new ValidationError('Invalid newTag name');
    if (n.parent != null && !validateTag(n.parent)) throw new ValidationError('Invalid newTag parent');
  }
  for (const r of renames) {
    if (!validateTag(r?.from) || !validateTag(r?.to)) throw new ValidationError('Invalid rename entry');
  }
  for (const m of merges) {
    if (!Array.isArray(m?.from) || m.from.length === 0 || !validateTag(m?.to)) throw new ValidationError('Invalid merge entry');
    for (const f of m.from) if (!validateTag(f)) throw new ValidationError('Invalid merge source');
  }
  for (const p of parents) {
    if (!validateTag(p?.tag)) throw new ValidationError('Invalid parent entry tag');
    if (p.parent != null && !validateTag(p.parent)) throw new ValidationError('Invalid parent entry parent');
  }
  for (const [, tags] of [...Object.entries(adds), ...Object.entries(removes)]) {
    if (!Array.isArray(tags)) throw new ValidationError('Assignment tags must be arrays');
    for (const t of tags) if (!validateTag(t)) throw new ValidationError('Invalid assignment tag');
  }

  const allBinIds = new Set([...Object.keys(adds), ...Object.keys(removes)]);
  if (allBinIds.size > MAX_BINS_PER_APPLY) throw new ValidationError(`At most ${MAX_BINS_PER_APPLY} bins per apply`);

  const proposedParent = new Map<string, string | null>();
  for (const p of parents) proposedParent.set(p.tag, p.parent);
  for (const n of newTags) if (n.parent) proposedParent.set(n.tag, n.parent);
  for (const [tag] of proposedParent) {
    const seen = new Set<string>();
    let cur: string | null | undefined = tag;
    while (cur) {
      if (seen.has(cur)) throw new HttpError(422, 'PARENT_CYCLE', `Tag "${tag}" would be its own ancestor`);
      seen.add(cur);
      cur = proposedParent.get(cur) ?? null;
    }
  }

  await requireMemberOrAbove(locationId, req.user!.id, 'apply tag suggestions');

  const allRenames: Array<{ from: string; to: string }> = [
    ...renames,
    ...merges.flatMap((m) => m.from.map((f) => ({ from: f, to: m.to }))),
  ];

  const counts = await withTransaction(async (txQuery) => {
    let tagsCreated = 0;
    let tagsRenamed = 0;
    let parentsSet = 0;
    let binsAddedTo = 0;
    let binsRemovedFrom = 0;

    const binIdList = [...allBinIds];
    if (binIdList.length > 0) {
      const placeholders = binIdList.map((_, i) => `$${i + 3}`).join(', ');
      const visible = await txQuery<{ id: string }>(
        `SELECT id FROM bins
         WHERE location_id = $1 AND deleted_at IS NULL
           AND (visibility = 'location' OR created_by = $2)
           AND id IN (${placeholders})`,
        [locationId, req.user!.id, ...binIdList],
      );
      const visibleSet = new Set(visible.rows.map((r) => r.id));
      for (const id of binIdList) {
        if (!visibleSet.has(id)) throw new ValidationError(`Bin ${id} not found in this location`);
      }
    }

    for (const r of allRenames) {
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
        [locationId, r.from, r.to],
      );
      await txQuery(
        `UPDATE tag_colors SET tag = $1, updated_at = ${d.now()}
         WHERE location_id = $2 AND tag = $3`,
        [r.to, locationId, r.from],
      );
      await txQuery(
        `UPDATE tag_colors SET parent_tag = $1, updated_at = ${d.now()}
         WHERE location_id = $2 AND parent_tag = $3`,
        [r.to, locationId, r.from],
      );
      if (result.rows.length > 0) tagsRenamed += 1;
    }

    for (const n of newTags) {
      await txQuery(
        `INSERT INTO tag_colors (id, location_id, tag, color, parent_tag)
         VALUES ($1, $2, $3, '', $4)
         ON CONFLICT (location_id, tag) DO NOTHING`,
        [generateUuid(), locationId, n.tag, n.parent ?? null],
      );
      tagsCreated += 1;
    }

    for (const p of parents) {
      const result = await txQuery<{ updated: number }>(
        `UPDATE tag_colors SET parent_tag = $1, updated_at = ${d.now()}
         WHERE location_id = $2 AND tag = $3
         RETURNING 1 AS updated`,
        [p.parent, locationId, p.tag],
      );
      if (result.rows.length > 0) parentsSet += 1;
    }

    for (const [binId, tags] of Object.entries(adds)) {
      if (tags.length === 0) continue;
      const result = await txQuery<{ updated: number }>(
        `UPDATE bins SET tags = (
           SELECT ${d.jsonGroupArray('tag')} FROM (
             SELECT DISTINCT jt.value AS tag FROM ${d.jsonEachFrom('bins.tags', 'jt')}
             UNION SELECT value AS tag FROM ${d.jsonEachFrom('$1', 'jt_new')}
           )
         ), updated_at = ${d.now()}
         WHERE id = $2 AND location_id = $3 AND deleted_at IS NULL
         RETURNING 1 AS updated`,
        [JSON.stringify(tags), binId, locationId],
      );
      if (result.rows.length > 0) binsAddedTo += 1;
    }

    for (const [binId, tags] of Object.entries(removes)) {
      if (tags.length === 0) continue;
      const result = await txQuery<{ updated: number }>(
        `UPDATE bins SET tags = (
           SELECT ${d.jsonGroupArray('jt.value')}
           FROM ${d.jsonEachFrom('bins.tags', 'jt')}
           WHERE jt.value NOT IN (SELECT value FROM ${d.jsonEachFrom('$1', 'jt_rem')})
         ), updated_at = ${d.now()}
         WHERE id = $2 AND location_id = $3 AND deleted_at IS NULL
         RETURNING 1 AS updated`,
        [JSON.stringify(tags), binId, locationId],
      );
      if (result.rows.length > 0) binsRemovedFrom += 1;
    }

    return { tagsCreated, tagsRenamed, parentsSet, binsAddedTo, binsRemovedFrom };
  });

  logRouteActivity(req, {
    entityType: 'tag',
    locationId,
    action: 'bulk_suggest',
    entityId: undefined,
    entityName: undefined,
    changes: { counts: { old: null, new: counts } },
  });

  res.json(counts);
}));

export default router;
