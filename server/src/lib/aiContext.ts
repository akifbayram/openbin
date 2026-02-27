import { query } from '../db.js';
import type { CommandRequest } from './commandParser.js';
import type { InventoryContext } from './inventoryQuery.js';

export const AVAILABLE_COLORS = ['red', 'orange', 'amber', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'purple', 'rose', 'pink', 'gray'];
export const AVAILABLE_ICONS = [
  'Package', 'Box', 'Archive', 'Wrench', 'Shirt', 'Book', 'Utensils', 'Laptop', 'Camera', 'Music',
  'Heart', 'Star', 'Home', 'Car', 'Bike', 'Plane', 'Briefcase', 'ShoppingBag', 'Gift', 'Lightbulb',
  'Scissors', 'Hammer', 'Paintbrush', 'Leaf', 'Apple', 'Coffee', 'Wine', 'Baby', 'Dog', 'Cat',
];

/** Fetch bins, areas, and trash for a location (shared between command and inventory contexts). */
async function fetchLocationData(locationId: string, userId: string) {
  const [binsResult, areasResult, trashResult] = await Promise.all([
    query(
      `SELECT b.id, b.name,
        COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name)) FROM (SELECT id, name FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items,
        b.tags, b.area_id, COALESCE(a.name, '') AS area_name, b.notes, b.icon, b.color,
        b.visibility,
        (SELECT COUNT(*) FROM photos WHERE photos.bin_id = b.id) AS photo_count,
        CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
       FROM bins b
       LEFT JOIN areas a ON a.id = b.area_id
       LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
       WHERE b.location_id = $1 AND b.deleted_at IS NULL`,
      [locationId, userId]
    ),
    query(
      'SELECT id, name FROM areas WHERE location_id = $1',
      [locationId]
    ),
    query(
      'SELECT id, name FROM bins WHERE location_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 20',
      [locationId]
    ),
  ]);
  return { binsResult, areasResult, trashResult };
}

function truncateNotes(notes: unknown): string {
  if (typeof notes === 'string' && notes.length > 200) return notes.slice(0, 200) + '...';
  return (notes as string) || '';
}

/** Build context for command/execute endpoints. */
export async function buildCommandContext(locationId: string, userId: string): Promise<CommandRequest['context']> {
  const { binsResult, areasResult, trashResult } = await fetchLocationData(locationId, userId);

  const bins = binsResult.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    items: r.items as Array<{ id: string; name: string }>,
    tags: r.tags as string[],
    area_id: r.area_id as string | null,
    area_name: r.area_name as string,
    notes: truncateNotes(r.notes),
    icon: r.icon as string,
    color: r.color as string,
    visibility: (r.visibility as string) || 'location',
    is_pinned: !!(r.is_pinned as number),
    photo_count: (r.photo_count as number) || 0,
  }));

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
export async function buildInventoryContext(locationId: string, userId: string): Promise<InventoryContext> {
  const { binsResult, areasResult, trashResult } = await fetchLocationData(locationId, userId);

  return {
    bins: binsResult.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      items: (r.items as Array<{ id: string; name: string }>).map((i) => i.name),
      tags: r.tags as string[],
      area_name: r.area_name as string,
      notes: truncateNotes(r.notes),
      visibility: (r.visibility as string) || 'location',
      is_pinned: !!(r.is_pinned as number),
      photo_count: (r.photo_count as number) || 0,
    })),
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
    `SELECT DISTINCT je.value AS tag FROM bins, json_each(bins.tags) je WHERE bins.location_id = $1 AND bins.deleted_at IS NULL`,
    [locationId]
  );
  return tagsResult.rows.map((r) => r.tag as string).sort();
}
