/** Shared SELECT columns for bin queries (requires b alias for bins, a alias for areas). */
export const BIN_SELECT_COLS = `b.id, b.location_id, b.name, b.area_id, COALESCE(a.name, '') AS area_name, COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name)) FROM (SELECT id, name FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items, b.notes, b.tags, b.icon, b.color, b.card_style, b.created_by, COALESCE((SELECT COALESCE(u.display_name, u.username) FROM users u WHERE u.id = b.created_by), '') AS created_by_name, b.visibility, b.created_at, b.updated_at`;

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
  whereSQL: string;
  orderClause: string;
  params: unknown[];
}

export function buildBinListQuery(filters: BinListFilterParams): BinListQuery {
  const whereClauses: string[] = ['b.location_id = $1', 'b.deleted_at IS NULL', '(b.visibility = \'location\' OR b.created_by = $2)'];
  const params: unknown[] = [filters.locationId, filters.userId];
  let paramIdx = 3;

  if (filters.q && filters.q.trim()) {
    const searchTerm = filters.q.trim();
    whereClauses.push(
      `(word_match(b.name, $${paramIdx}) = 1 OR word_match(b.notes, $${paramIdx}) = 1 OR word_match(b.id, $${paramIdx}) = 1 OR word_match(COALESCE(a.name, ''), $${paramIdx}) = 1 OR EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id AND word_match(bi.name, $${paramIdx}) = 1) OR EXISTS (SELECT 1 FROM json_each(b.tags) WHERE word_match(value, $${paramIdx}) = 1))`
    );
    params.push(searchTerm);
    paramIdx++;
  }

  // Multi-tag filter (tags param takes precedence over single tag)
  const tagList = filters.tags ? filters.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  if (tagList.length > 0) {
    const tagPlaceholders = tagList.map((_, i) => `$${paramIdx + i}`);
    if (filters.tagMode === 'all') {
      whereClauses.push(`(SELECT COUNT(DISTINCT value) FROM json_each(b.tags) WHERE value IN (${tagPlaceholders.join(', ')})) = ${tagList.length}`);
    } else {
      whereClauses.push(`EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value IN (${tagPlaceholders.join(', ')}))`);
    }
    params.push(...tagList);
    paramIdx += tagList.length;
  } else if (filters.tag && filters.tag.trim()) {
    whereClauses.push(`EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value = $${paramIdx})`);
    params.push(filters.tag.trim());
    paramIdx++;
  }

  // Multi-area filter (areas param takes precedence over single area_id)
  const areaList = filters.areas ? filters.areas.split(',').map((a) => a.trim()).filter(Boolean) : [];
  if (areaList.length > 0) {
    const hasUnassigned = areaList.includes('__unassigned__');
    const realAreas = areaList.filter((a) => a !== '__unassigned__');
    const parts: string[] = [];
    if (realAreas.length > 0) {
      const areaPlaceholders = realAreas.map((_, i) => `$${paramIdx + i}`);
      parts.push(`b.area_id IN (${areaPlaceholders.join(', ')})`);
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
      whereClauses.push(`b.area_id = $${paramIdx}`);
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
    whereClauses.push(`(b.tags = '[]' OR b.tags = '') AND b.area_id IS NULL AND NOT EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id)`);
  }

  const validSorts: Record<string, string> = {
    name: 'b.name COLLATE NOCASE',
    created_at: 'b.created_at',
    updated_at: 'b.updated_at',
  };
  const dir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
  const sortKey = filters.sort || '';

  let orderClause: string;
  if (sortKey === 'area') {
    orderClause = `CASE WHEN a.name IS NULL OR a.name = '' THEN 1 ELSE 0 END ASC, a.name COLLATE NOCASE ${dir}, b.name COLLATE NOCASE ASC`;
  } else {
    const orderBy = validSorts[sortKey] || 'b.updated_at';
    orderClause = `${orderBy} ${dir}`;
  }

  return {
    whereSQL: whereClauses.join(' AND '),
    orderClause,
    params,
  };
}
