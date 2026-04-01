import { d, query } from '../db.js';
import { sanitizeBinForContext } from './aiSanitize.js';
import type { CommandRequest } from './commandParser.js';
import type { InventoryContext } from './inventoryQuery.js';

export const AVAILABLE_COLORS = ['red', 'orange', 'amber', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'purple', 'rose', 'pink', 'gray'];
export const AVAILABLE_ICONS = [
  'Package', 'Box', 'Archive', 'Wrench', 'Shirt', 'Book', 'Utensils', 'Laptop', 'Camera', 'Music',
  'Heart', 'Star', 'Home', 'Car', 'Bike', 'Plane', 'Briefcase', 'ShoppingBag', 'Gift', 'Lightbulb',
  'Scissors', 'Hammer', 'Paintbrush', 'Leaf', 'Apple', 'Coffee', 'Wine', 'Baby', 'Dog', 'Cat',
];

function appendInClause(sql: string, column: string, startIndex: number, ids: string[]): { sql: string; params: string[] } {
  const placeholders = ids.map((_, i) => `$${startIndex + i}`).join(', ');
  return { sql: `${sql} AND ${column} IN (${placeholders})`, params: ids };
}

/** Fetch bins, areas, trash, and custom field data for a location. */
async function fetchLocationData(locationId: string, userId: string, binIds?: string[]) {
  let binsSql = `SELECT b.id, b.name,
        COALESCE((SELECT ${d.jsonGroupArray(d.jsonObject("'id'", 'bi.id', "'name'", 'bi.name', "'quantity'", 'bi.quantity'))} FROM (SELECT id, name, quantity FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items,
        b.tags, b.area_id, COALESCE(a.name, '') AS area_name, b.notes, b.icon, b.color,
        b.visibility,
        (SELECT COUNT(*) FROM photos WHERE photos.bin_id = b.id) AS photo_count,
        CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
       FROM bins b
       LEFT JOIN areas a ON a.id = b.area_id
       LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
       WHERE b.location_id = $1 AND b.deleted_at IS NULL`;
  const binsParams: string[] = [locationId, userId];
  if (binIds?.length) {
    const inClause = appendInClause(binsSql, 'b.id', 3, binIds);
    binsSql = inClause.sql;
    binsParams.push(...inClause.params);
  }

  let cfSql = `SELECT v.bin_id, f.name AS field_name, v.value
       FROM bin_custom_field_values v
       JOIN location_custom_fields f ON f.id = v.field_id
       JOIN bins b ON b.id = v.bin_id
       WHERE f.location_id = $1 AND b.deleted_at IS NULL`;
  const cfParams: string[] = [locationId];
  if (binIds?.length) {
    const inClause = appendInClause(cfSql, 'v.bin_id', 2, binIds);
    cfSql = inClause.sql;
    cfParams.push(...inClause.params);
  }

  const [binsResult, areasResult, trashResult, cfResult] = await Promise.all([
    query(binsSql, binsParams),
    query(
      'SELECT id, name FROM areas WHERE location_id = $1',
      [locationId]
    ),
    query(
      'SELECT id, name FROM bins WHERE location_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 20',
      [locationId]
    ),
    query<{ bin_id: string; field_name: string; value: string }>(cfSql, cfParams),
  ]);

  // Build a map: binId -> Record<fieldName, value>
  const customFieldsByBin = new Map<string, Record<string, string>>();
  for (const row of cfResult.rows) {
    let map = customFieldsByBin.get(row.bin_id);
    if (!map) { map = {}; customFieldsByBin.set(row.bin_id, map); }
    map[row.field_name] = row.value;
  }

  return { binsResult, areasResult, trashResult, customFieldsByBin };
}

function truncateNotes(notes: unknown): string {
  if (typeof notes === 'string' && notes.length > 200) return `${notes.slice(0, 200)}...`;
  return (notes as string) || '';
}

/** Build context for command/execute endpoints. */
export async function buildCommandContext(locationId: string, userId: string, binIds?: string[]): Promise<CommandRequest['context']> {
  const { binsResult, areasResult, trashResult, customFieldsByBin } = await fetchLocationData(locationId, userId, binIds);

  const bins = binsResult.rows.map((r) => {
    const binId = r.id as string;
    const cf = customFieldsByBin.get(binId);
    return sanitizeBinForContext({
      id: binId,
      name: r.name as string,
      items: r.items as Array<{ id: string; name: string; quantity: number | null }>,
      tags: r.tags as string[],
      area_id: r.area_id as string | null,
      area_name: r.area_name as string,
      notes: truncateNotes(r.notes),
      icon: r.icon as string,
      color: r.color as string,
      visibility: (r.visibility as string) || 'location',
      is_pinned: !!(r.is_pinned as number),
      photo_count: (r.photo_count as number) || 0,
      ...(cf ? { custom_fields: cf } : {}),
    });
  });

  const areas = areasResult.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
  }));

  const trash_bins = trashResult.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
  }));

  return { bins, areas, trash_bins, availableColors: AVAILABLE_COLORS, availableIcons: AVAILABLE_ICONS };
}

/** Build context for the query (read-only) endpoint. */
export async function buildInventoryContext(locationId: string, userId: string, binIds?: string[]): Promise<InventoryContext> {
  const { binsResult, areasResult, trashResult, customFieldsByBin } = await fetchLocationData(locationId, userId, binIds);

  return {
    bins: binsResult.rows.map((r) => {
      const binId = r.id as string;
      const cf = customFieldsByBin.get(binId);
      const sanitized = sanitizeBinForContext({
        id: binId,
        name: r.name as string,
        items: r.items as Array<{ id: string; name: string; quantity: number | null }>,
        tags: r.tags as string[],
        area_name: r.area_name as string,
        notes: truncateNotes(r.notes),
        visibility: (r.visibility as string) || 'location',
        is_pinned: !!(r.is_pinned as number),
        photo_count: (r.photo_count as number) || 0,
        ...(cf ? { custom_fields: cf } : {}),
      });
      return {
        ...sanitized,
        items: sanitized.items.map((i) => i.quantity ? `${i.name} (×${i.quantity})` : i.name),
      };
    }),
    areas: areasResult.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
    })),
    trash_bins: trashResult.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
    })),
  };
}

/** Fetch distinct tags for a location (for tag reuse suggestions). */
export async function fetchExistingTags(locationId: string): Promise<string[]> {
  const tagsResult = await query(
    `SELECT DISTINCT je.value AS tag FROM bins, ${d.jsonEachFrom('bins.tags', 'je')} WHERE bins.location_id = $1 AND bins.deleted_at IS NULL`,
    [locationId]
  );
  return tagsResult.rows.map((r) => r.tag as string).sort();
}
