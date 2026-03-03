import { query } from '../db.js';
import type { ToolDefinition } from './aiStreamingCaller.js';
import type { ExecuteResult } from './commandExecutor.js';
import { executeActions } from './commandExecutor.js';
import type { CommandAction } from './commandParser.js';

// ---------------------------------------------------------------------------
// Read-only tool names
// ---------------------------------------------------------------------------

const READ_ONLY_TOOLS = new Set([
  'search_bins',
  'get_bin',
  'search_items',
  'list_areas',
  'list_tags',
]);

export function isReadOnlyTool(name: string): boolean {
  return READ_ONLY_TOOLS.has(name);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export function getChatToolDefinitions(): ToolDefinition[] {
  return [
    // ---- Read-only tools ----
    {
      name: 'search_bins',
      description:
        'Search bins by text query, tag, or area. Returns matching bins with their items, tags, and area. Use this to find bins matching user questions.',
      parameters: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'Search text — matches against bin name, notes, item names, and tags',
          },
          tag: {
            type: 'string',
            description: 'Filter by a single tag (exact match)',
          },
          area_id: {
            type: 'string',
            description: 'Filter by area ID. Use "__unassigned__" for bins with no area.',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (1-50, default 20)',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_bin',
      description: 'Get full details of a single bin by its ID, including all items, tags, notes, area, and metadata.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: {
            type: 'string',
            description: 'The bin ID (6-character short code)',
          },
        },
        required: ['bin_id'],
      },
    },
    {
      name: 'search_items',
      description: 'Search for items across all bins. Returns matching items with the bin they belong to.',
      parameters: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'Search text to match against item names',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (1-50, default 20)',
          },
        },
        required: [],
      },
    },
    {
      name: 'list_areas',
      description: 'List all areas in the location with their bin counts.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'list_tags',
      description: 'List all tags used across bins in the location with usage counts.',
      parameters: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'Optional text to filter tags by name',
          },
        },
        required: [],
      },
    },

    // ---- Write tools ----
    {
      name: 'create_bin',
      description: 'Create a new bin. Optionally set area, items, tags, notes, icon, and color.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Bin name (required)' },
          area_name: { type: 'string', description: 'Area to assign (creates area if it does not exist)' },
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Initial items to add to the bin',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to assign',
          },
          notes: { type: 'string', description: 'Notes for the bin' },
          icon: { type: 'string', description: 'Icon identifier' },
          color: { type: 'string', description: 'Color value' },
        },
        required: ['name'],
      },
    },
    {
      name: 'update_bin',
      description: 'Update one or more fields on an existing bin. Only provided fields are changed.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'Bin ID to update' },
          bin_name: { type: 'string', description: 'Current bin name (for logging)' },
          name: { type: 'string', description: 'New bin name' },
          notes: { type: 'string', description: 'New notes (replaces existing)' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Replace all tags with this list',
          },
          area_name: { type: 'string', description: 'New area name (creates if needed)' },
          icon: { type: 'string', description: 'New icon' },
          color: { type: 'string', description: 'New color' },
          visibility: {
            type: 'string',
            enum: ['location', 'private'],
            description: 'Bin visibility',
          },
        },
        required: ['bin_id', 'bin_name'],
      },
    },
    {
      name: 'delete_bin',
      description: 'Soft-delete a bin (moves to trash, can be restored).',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'Bin ID to delete' },
          bin_name: { type: 'string', description: 'Bin name (for logging)' },
        },
        required: ['bin_id', 'bin_name'],
      },
    },
    {
      name: 'add_items',
      description: 'Add one or more items to a bin.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'Bin ID' },
          bin_name: { type: 'string', description: 'Bin name (for logging)' },
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Item names to add',
          },
        },
        required: ['bin_id', 'bin_name', 'items'],
      },
    },
    {
      name: 'remove_items',
      description: 'Remove one or more items from a bin by name.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'Bin ID' },
          bin_name: { type: 'string', description: 'Bin name (for logging)' },
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Item names to remove',
          },
        },
        required: ['bin_id', 'bin_name', 'items'],
      },
    },
    {
      name: 'set_area',
      description: 'Assign a bin to an area. Creates the area if it does not exist.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'Bin ID' },
          bin_name: { type: 'string', description: 'Bin name (for logging)' },
          area_name: { type: 'string', description: 'Area name to assign' },
        },
        required: ['bin_id', 'bin_name', 'area_name'],
      },
    },
    {
      name: 'add_tags',
      description: 'Add one or more tags to a bin (merges with existing tags).',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'Bin ID' },
          bin_name: { type: 'string', description: 'Bin name (for logging)' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to add',
          },
        },
        required: ['bin_id', 'bin_name', 'tags'],
      },
    },
    {
      name: 'remove_tags',
      description: 'Remove one or more tags from a bin.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'Bin ID' },
          bin_name: { type: 'string', description: 'Bin name (for logging)' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to remove',
          },
        },
        required: ['bin_id', 'bin_name', 'tags'],
      },
    },
    {
      name: 'create_area',
      description: 'Create a new area in the location.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Area name' },
        },
        required: ['name'],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Read-only tool executor
// ---------------------------------------------------------------------------

export async function executeReadOnlyTool(
  name: string,
  args: Record<string, unknown>,
  locationId: string,
  userId: string,
): Promise<string> {
  switch (name) {
    case 'search_bins':
      return searchBins(args, locationId, userId);
    case 'get_bin':
      return getBin(args, locationId, userId);
    case 'search_items':
      return searchItems(args, locationId, userId);
    case 'list_areas':
      return listAreas(locationId);
    case 'list_tags':
      return listTags(args, locationId);
    default:
      return JSON.stringify({ error: `Unknown read-only tool: ${name}` });
  }
}

async function searchBins(
  args: Record<string, unknown>,
  locationId: string,
  userId: string,
): Promise<string> {
  const qRaw = typeof args.q === 'string' ? args.q.trim() : '';
  const tag = typeof args.tag === 'string' ? args.tag.trim() : '';
  const areaId = typeof args.area_id === 'string' ? args.area_id.trim() : '';
  const rawLimit = typeof args.limit === 'number' ? args.limit : 20;
  const limit = Math.max(1, Math.min(50, rawLimit));

  const whereClauses: string[] = [
    'b.location_id = $1',
    'b.deleted_at IS NULL',
    "(b.visibility = 'location' OR b.created_by = $2)",
  ];
  const params: unknown[] = [locationId, userId];
  let paramIdx = 3;

  if (qRaw) {
    whereClauses.push(
      `(word_match(b.name, $${paramIdx}) = 1 OR word_match(b.notes, $${paramIdx}) = 1 OR EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id AND word_match(bi.name, $${paramIdx}) = 1) OR EXISTS (SELECT 1 FROM json_each(b.tags) WHERE word_match(value, $${paramIdx}) = 1))`,
    );
    params.push(qRaw);
    paramIdx++;
  }

  if (tag) {
    whereClauses.push(`EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value = $${paramIdx})`);
    params.push(tag);
    paramIdx++;
  }

  if (areaId) {
    if (areaId === '__unassigned__') {
      whereClauses.push('b.area_id IS NULL');
    } else {
      whereClauses.push(`b.area_id = $${paramIdx}`);
      params.push(areaId);
      paramIdx++;
    }
  }

  params.push(limit);
  const limitParam = `$${paramIdx}`;

  const result = await query(
    `SELECT b.id, b.name, COALESCE(a.name, '') AS area_name, b.notes, b.tags, b.icon, b.color,
       COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name)) FROM (SELECT id, name FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items
     FROM bins b
     LEFT JOIN areas a ON a.id = b.area_id
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY b.updated_at DESC
     LIMIT ${limitParam}`,
    params,
  );

  return JSON.stringify({ bins: result.rows, count: result.rowCount });
}

async function getBin(
  args: Record<string, unknown>,
  locationId: string,
  userId: string,
): Promise<string> {
  const binId = typeof args.bin_id === 'string' ? args.bin_id.trim() : '';
  if (!binId) {
    return JSON.stringify({ error: 'bin_id is required' });
  }

  const result = await query(
    `SELECT b.id, b.name, COALESCE(a.name, '') AS area_name, b.area_id, b.notes, b.tags, b.icon, b.color, b.visibility,
       b.created_at, b.updated_at,
       COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name)) FROM (SELECT id, name FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items,
       (SELECT COUNT(*) FROM photos WHERE photos.bin_id = b.id) AS photo_count,
       CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
     FROM bins b
     LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $3
     WHERE b.id = $1 AND b.location_id = $2 AND b.deleted_at IS NULL
       AND (b.visibility = 'location' OR b.created_by = $3)`,
    [binId, locationId, userId],
  );

  if (result.rows.length === 0) {
    return JSON.stringify({ error: 'Bin not found' });
  }

  return JSON.stringify(result.rows[0]);
}

async function searchItems(
  args: Record<string, unknown>,
  locationId: string,
  userId: string,
): Promise<string> {
  const qRaw = typeof args.q === 'string' ? args.q.trim() : '';
  const rawLimit = typeof args.limit === 'number' ? args.limit : 20;
  const limit = Math.max(1, Math.min(50, rawLimit));

  const whereClauses: string[] = [
    'b.location_id = $1',
    'b.deleted_at IS NULL',
    "(b.visibility = 'location' OR b.created_by = $2)",
  ];
  const params: unknown[] = [locationId, userId];
  let paramIdx = 3;

  if (qRaw) {
    whereClauses.push(`word_match(bi.name, $${paramIdx}) = 1`);
    params.push(qRaw);
    paramIdx++;
  }

  params.push(limit);
  const limitParam = `$${paramIdx}`;

  const result = await query(
    `SELECT bi.id AS item_id, bi.name AS item_name, b.id AS bin_id, b.name AS bin_name,
       COALESCE(a.name, '') AS area_name
     FROM bin_items bi
     JOIN bins b ON b.id = bi.bin_id
     LEFT JOIN areas a ON a.id = b.area_id
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY bi.name COLLATE NOCASE ASC
     LIMIT ${limitParam}`,
    params,
  );

  return JSON.stringify({ items: result.rows, count: result.rowCount });
}

async function listAreas(locationId: string): Promise<string> {
  const result = await query(
    `SELECT ar.id, ar.name,
       (SELECT COUNT(*) FROM bins b WHERE b.area_id = ar.id AND b.deleted_at IS NULL) AS bin_count
     FROM areas ar
     WHERE ar.location_id = $1
     ORDER BY ar.name COLLATE NOCASE ASC`,
    [locationId],
  );

  return JSON.stringify({ areas: result.rows, count: result.rowCount });
}

async function listTags(
  args: Record<string, unknown>,
  locationId: string,
): Promise<string> {
  const qRaw = typeof args.q === 'string' ? args.q.trim() : '';

  let sql = `SELECT je.value AS tag, COUNT(*) AS usage_count
     FROM bins b, json_each(b.tags) je
     WHERE b.location_id = $1 AND b.deleted_at IS NULL`;
  const params: unknown[] = [locationId];

  if (qRaw) {
    sql += ' AND word_match(je.value, $2) = 1';
    params.push(qRaw);
  }

  sql += ' GROUP BY je.value ORDER BY usage_count DESC, je.value COLLATE NOCASE ASC';

  const result = await query(sql, params);

  return JSON.stringify({ tags: result.rows, count: result.rowCount });
}

// ---------------------------------------------------------------------------
// Write tool -> CommandAction converter
// ---------------------------------------------------------------------------

export function toolCallToCommandAction(
  name: string,
  args: Record<string, unknown>,
): CommandAction | null {
  switch (name) {
    case 'create_bin': {
      const binName = typeof args.name === 'string' ? args.name.trim() : '';
      if (!binName) return null;
      return {
        type: 'create_bin',
        name: binName,
        area_name: typeof args.area_name === 'string' ? args.area_name.trim() : undefined,
        items: Array.isArray(args.items)
          ? (args.items as unknown[]).filter((i): i is string => typeof i === 'string')
          : undefined,
        tags: Array.isArray(args.tags)
          ? (args.tags as unknown[]).filter((t): t is string => typeof t === 'string')
          : undefined,
        notes: typeof args.notes === 'string' ? args.notes : undefined,
        icon: typeof args.icon === 'string' ? args.icon : undefined,
        color: typeof args.color === 'string' ? args.color : undefined,
      };
    }

    case 'update_bin': {
      const binId = typeof args.bin_id === 'string' ? args.bin_id.trim() : '';
      if (!binId) return null;
      const vis = args.visibility as string | undefined;
      return {
        type: 'update_bin',
        bin_id: binId,
        bin_name: typeof args.bin_name === 'string' ? args.bin_name : '',
        name: typeof args.name === 'string' ? args.name.trim() : undefined,
        notes: typeof args.notes === 'string' ? args.notes : undefined,
        tags: Array.isArray(args.tags)
          ? (args.tags as unknown[]).filter((t): t is string => typeof t === 'string')
          : undefined,
        area_name: typeof args.area_name === 'string' ? args.area_name.trim() : undefined,
        icon: typeof args.icon === 'string' ? args.icon : undefined,
        color: typeof args.color === 'string' ? args.color : undefined,
        visibility: vis === 'location' || vis === 'private' ? vis : undefined,
      };
    }

    case 'delete_bin': {
      const binId = typeof args.bin_id === 'string' ? args.bin_id.trim() : '';
      if (!binId) return null;
      return {
        type: 'delete_bin',
        bin_id: binId,
        bin_name: typeof args.bin_name === 'string' ? args.bin_name : '',
      };
    }

    case 'add_items': {
      const binId = typeof args.bin_id === 'string' ? args.bin_id.trim() : '';
      const items = Array.isArray(args.items)
        ? (args.items as unknown[]).filter((i): i is string => typeof i === 'string').map((i) => i.trim()).filter(Boolean)
        : [];
      if (!binId || items.length === 0) return null;
      return {
        type: 'add_items',
        bin_id: binId,
        bin_name: typeof args.bin_name === 'string' ? args.bin_name : '',
        items,
      };
    }

    case 'remove_items': {
      const binId = typeof args.bin_id === 'string' ? args.bin_id.trim() : '';
      const items = Array.isArray(args.items)
        ? (args.items as unknown[]).filter((i): i is string => typeof i === 'string').map((i) => i.trim()).filter(Boolean)
        : [];
      if (!binId || items.length === 0) return null;
      return {
        type: 'remove_items',
        bin_id: binId,
        bin_name: typeof args.bin_name === 'string' ? args.bin_name : '',
        items,
      };
    }

    case 'set_area': {
      const binId = typeof args.bin_id === 'string' ? args.bin_id.trim() : '';
      const areaName = typeof args.area_name === 'string' ? args.area_name.trim() : '';
      if (!binId) return null;
      return {
        type: 'set_area',
        bin_id: binId,
        bin_name: typeof args.bin_name === 'string' ? args.bin_name : '',
        area_id: null,
        area_name: areaName,
      };
    }

    case 'add_tags': {
      const binId = typeof args.bin_id === 'string' ? args.bin_id.trim() : '';
      const tags = Array.isArray(args.tags)
        ? (args.tags as unknown[]).filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean)
        : [];
      if (!binId || tags.length === 0) return null;
      return {
        type: 'add_tags',
        bin_id: binId,
        bin_name: typeof args.bin_name === 'string' ? args.bin_name : '',
        tags,
      };
    }

    case 'remove_tags': {
      const binId = typeof args.bin_id === 'string' ? args.bin_id.trim() : '';
      const tags = Array.isArray(args.tags)
        ? (args.tags as unknown[]).filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean)
        : [];
      if (!binId || tags.length === 0) return null;
      return {
        type: 'remove_tags',
        bin_id: binId,
        bin_name: typeof args.bin_name === 'string' ? args.bin_name : '',
        tags,
      };
    }

    case 'create_area': {
      // create_area is not a native CommandAction — we handle it via set_area on a dummy
      // Actually, create_area doesn't map to a single CommandAction since CommandAction
      // doesn't have a standalone create_area type. We return null and handle it specially
      // in executeWriteActions.
      return null;
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Write action executor
// ---------------------------------------------------------------------------

export async function executeWriteActions(
  actions: CommandAction[],
  locationId: string,
  userId: string,
  userName: string,
  authMethod?: 'jwt' | 'api_key',
  apiKeyId?: string,
): Promise<ExecuteResult> {
  return executeActions(actions, locationId, userId, userName, authMethod, apiKeyId);
}

// ---------------------------------------------------------------------------
// Standalone create_area handler (not in CommandAction union)
// ---------------------------------------------------------------------------

export async function executeCreateArea(
  args: Record<string, unknown>,
  locationId: string,
  userId: string,
): Promise<string> {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (!name) {
    return JSON.stringify({ error: 'Area name is required' });
  }

  // Check if area already exists
  const existing = await query(
    'SELECT id, name FROM areas WHERE location_id = $1 AND LOWER(name) = LOWER($2)',
    [locationId, name],
  );
  if (existing.rows.length > 0) {
    return JSON.stringify({ area: existing.rows[0], created: false, message: 'Area already exists' });
  }

  const { generateUuid } = await import('../db.js');
  const areaId = generateUuid();
  await query(
    'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
    [areaId, locationId, name, userId],
  );

  return JSON.stringify({ area: { id: areaId, name }, created: true });
}
