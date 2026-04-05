import { d, getDialect, query } from '../db.js';

/** Shared SELECT columns for bin queries (requires b alias for bins, a alias for areas). */
export function BIN_SELECT_COLS(): string {
  return `b.id, b.short_code, b.location_id, b.name, b.area_id, COALESCE(a.name, '') AS area_name, COALESCE((SELECT ${d.jsonGroupArray(d.jsonObject("'id'", 'bi.id', "'name'", 'bi.name', "'quantity'", 'bi.quantity'))} FROM (SELECT id, name, quantity FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items, b.notes, b.tags, b.icon, b.color, b.card_style, b.created_by, COALESCE((SELECT COALESCE(u.display_name, u.username) FROM users u WHERE u.id = b.created_by), '') AS created_by_name, b.visibility, b.created_at, b.updated_at, COALESCE((SELECT ${d.jsonGroupObject('bcfv.field_id', 'bcfv.value')} FROM bin_custom_field_values bcfv WHERE bcfv.bin_id = b.id), '{}') AS custom_fields`;
}

/**
 * Fetch a single bin by ID with BIN_SELECT_COLS.
 * - `userId`: include `is_pinned` column via pinned_bins join
 * - `excludeDeleted`: add `AND b.deleted_at IS NULL` filter
 */
export async function fetchBinById(
  binId: string,
  options?: { userId?: string; excludeDeleted?: boolean },
): Promise<Record<string, any> | null> {
  const userId = options?.userId;
  const excludeDeleted = options?.excludeDeleted ?? false;

  const pinnedCol = userId ? ', CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned' : '';
  const pinnedJoin = userId ? 'LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2' : '';
  const deletedFilter = excludeDeleted ? ' AND b.deleted_at IS NULL' : '';

  const params: unknown[] = userId ? [binId, userId] : [binId];

  const result = await query(
    `SELECT ${BIN_SELECT_COLS()}${pinnedCol} FROM bins b LEFT JOIN areas a ON a.id = b.area_id ${pinnedJoin} WHERE b.id = $1${deletedFilter}`,
    params,
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

export interface BinListFilterParams {
  locationId: string;
  userId: string;
  q?: string;
  tag?: string;
  tags?: string;
  tagMode?: 'any' | 'all';
  areaId?: string;
  areas?: string;
  colors?: string;
  hasItems?: string;
  hasNotes?: string;
  needsOrganizing?: string;
  sort?: string;
  sortDir?: string;
}

export interface BinListQuery {
  ctePrefix: string;
  whereSQL: string;
  orderClause: string;
  params: unknown[];
}

export function buildBinListQuery(filters: BinListFilterParams): BinListQuery {
  const whereClauses: string[] = ['b.location_id = $1', 'b.deleted_at IS NULL', '(b.visibility = \'location\' OR b.created_by = $2)'];
  const params: unknown[] = [filters.locationId, filters.userId];
  let paramIdx = 3;

  if (filters.q?.trim()) {
    const searchTerm = filters.q.trim();
    whereClauses.push(
      `(${d.fuzzyMatch('b.name', `$${paramIdx}`)} OR ${d.fuzzyMatch('b.notes', `$${paramIdx}`)} OR ${d.fuzzyMatch('b.short_code', `$${paramIdx}`)} OR ${d.fuzzyMatch("COALESCE(a.name, '')", `$${paramIdx}`)} OR EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id AND ${d.fuzzyMatch('bi.name', `$${paramIdx}`)}) OR EXISTS (SELECT 1 FROM ${d.jsonEach('b.tags')} WHERE ${d.fuzzyMatch('value', `$${paramIdx}`)}) OR EXISTS (SELECT 1 FROM bin_custom_field_values bcfv WHERE bcfv.bin_id = b.id AND ${d.fuzzyMatch('bcfv.value', `$${paramIdx}`)}))`
    );
    params.push(searchTerm);
    paramIdx++;
  }

  // Multi-tag filter (tags param takes precedence over single tag)
  // Each tag is expanded to also match children: value = tag OR value IN (children of tag)
  const tagList = filters.tags ? filters.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  if (tagList.length > 0) {
    const expandedClauses: string[] = [];
    for (const t of tagList) {
      const p = `$${paramIdx}`;
      expandedClauses.push(
        `(value = ${p} OR value IN (SELECT tag FROM tag_colors WHERE parent_tag = ${p} AND location_id = $1))`,
      );
      params.push(t);
      paramIdx++;
    }
    if (filters.tagMode === 'all') {
      const allClauses = expandedClauses.map(
        (clause) => `EXISTS (SELECT 1 FROM ${d.jsonEach('b.tags')} WHERE ${clause})`,
      );
      whereClauses.push(`(${allClauses.join(' AND ')})`);
    } else {
      const anyClauses = expandedClauses.map(
        (clause) => `EXISTS (SELECT 1 FROM ${d.jsonEach('b.tags')} WHERE ${clause})`,
      );
      whereClauses.push(`(${anyClauses.join(' OR ')})`);
    }
  } else if (filters.tag?.trim()) {
    const p = `$${paramIdx}`;
    whereClauses.push(
      `EXISTS (SELECT 1 FROM ${d.jsonEach('b.tags')} WHERE value = ${p} OR value IN (SELECT tag FROM tag_colors WHERE parent_tag = ${p} AND location_id = $1))`,
    );
    params.push(filters.tag.trim());
    paramIdx++;
  }

  // Multi-area filter (areas param takes precedence over single area_id)
  // Uses recursive CTE to expand selected areas to include all descendants
  let ctePrefix = '';
  const areaList = filters.areas ? filters.areas.split(',').map((a) => a.trim()).filter(Boolean) : [];
  if (areaList.length > 0) {
    const hasUnassigned = areaList.includes('__unassigned__');
    const realAreas = areaList.filter((a) => a !== '__unassigned__');
    const parts: string[] = [];
    if (realAreas.length > 0) {
      const areaPlaceholders = realAreas.map((_, i) => `$${paramIdx + i}`);
      ctePrefix = `WITH RECURSIVE area_subtree AS (SELECT id FROM areas WHERE id IN (${areaPlaceholders.join(', ')}) UNION ALL SELECT c.id FROM areas c JOIN area_subtree s ON c.parent_id = s.id) `;
      parts.push('b.area_id IN (SELECT id FROM area_subtree)');
      params.push(...realAreas);
      paramIdx += realAreas.length;
    }
    if (hasUnassigned) {
      parts.push('b.area_id IS NULL');
    }
    whereClauses.push(`(${parts.join(' OR ')})`);
  } else if (filters.areaId) {
    if (filters.areaId === '__unassigned__') {
      whereClauses.push('b.area_id IS NULL');
    } else {
      const placeholder = `$${paramIdx}`;
      ctePrefix = `WITH RECURSIVE area_subtree AS (SELECT id FROM areas WHERE id = ${placeholder} UNION ALL SELECT c.id FROM areas c JOIN area_subtree s ON c.parent_id = s.id) `;
      whereClauses.push('b.area_id IN (SELECT id FROM area_subtree)');
      params.push(filters.areaId);
      paramIdx++;
    }
  }

  // Color filter
  const colorList = filters.colors ? filters.colors.split(',').map((c) => c.trim()).filter(Boolean) : [];
  if (colorList.length > 0) {
    const colorPlaceholders = colorList.map((_, i) => `$${paramIdx + i}`);
    whereClauses.push(`b.color IN (${colorPlaceholders.join(', ')})`);
    params.push(...colorList);
    paramIdx += colorList.length;
  }

  // Has items filter
  if (filters.hasItems === 'true') {
    whereClauses.push('EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id)');
  }

  // Has notes filter
  if (filters.hasNotes === 'true') {
    whereClauses.push("b.notes IS NOT NULL AND b.notes != '' AND TRIM(b.notes) != ''");
  }

  if (filters.needsOrganizing === 'true') {
    const emptyTags = getDialect() === 'sqlite' ? "(b.tags = '[]' OR b.tags = '')" : "b.tags = '[]'::jsonb";
    whereClauses.push(`${emptyTags} AND b.area_id IS NULL AND NOT EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id)`);
  }

  const validSorts: Record<string, string> = {
    name: `b.name ${d.nocase()}`,
    created_at: 'b.created_at',
    updated_at: 'b.updated_at',
  };
  const dir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
  const sortKey = filters.sort || '';

  let orderClause: string;
  if (sortKey === 'area') {
    orderClause = `CASE WHEN a.name IS NULL OR a.name = '' THEN 1 ELSE 0 END ASC, a.name ${d.nocase()} ${dir}, b.name ${d.nocase()} ASC`;
  } else {
    const orderBy = validSorts[sortKey] || 'b.updated_at';
    orderClause = `${orderBy} ${dir}`;
  }

  return {
    ctePrefix,
    whereSQL: whereClauses.join(' AND '),
    orderClause,
    params,
  };
}
