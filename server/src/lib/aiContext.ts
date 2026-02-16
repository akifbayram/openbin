import { query } from '../db.js';
import type { CommandRequest } from './commandParser.js';
import type { InventoryContext } from './inventoryQuery.js';

export const AVAILABLE_COLORS = ['red', 'orange', 'amber', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'purple', 'rose', 'pink', 'gray'];
export const AVAILABLE_ICONS = [
  'Package', 'Box', 'Archive', 'Wrench', 'Shirt', 'Book', 'Utensils', 'Laptop', 'Camera', 'Music',
  'Heart', 'Star', 'Home', 'Car', 'Bike', 'Plane', 'Briefcase', 'ShoppingBag', 'Gift', 'Lightbulb',
  'Scissors', 'Hammer', 'Paintbrush', 'Leaf', 'Apple', 'Coffee', 'Wine', 'Baby', 'Dog', 'Cat',
];

/** Fetch bins and areas for a location (shared between command and inventory contexts). */
async function fetchLocationBinsAndAreas(locationId: string) {
  const [binsResult, areasResult] = await Promise.all([
    query(
      `SELECT b.id, b.name, COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name)) FROM (SELECT id, name FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items, b.tags, b.area_id, COALESCE(a.name, '') AS area_name, b.notes, b.icon, b.color, b.short_code
       FROM bins b
       LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.location_id = $1 AND b.deleted_at IS NULL`,
      [locationId]
    ),
    query(
      'SELECT id, name FROM areas WHERE location_id = $1',
      [locationId]
    ),
  ]);
  return { binsResult, areasResult };
}

function truncateNotes(notes: unknown): string {
  if (typeof notes === 'string' && notes.length > 200) return notes.slice(0, 200) + '...';
  return (notes as string) || '';
}

/** Build context for command/execute endpoints. */
export async function buildCommandContext(locationId: string): Promise<CommandRequest['context']> {
  const { binsResult, areasResult } = await fetchLocationBinsAndAreas(locationId);

  const bins = binsResult.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    items: (r.items as Array<{ id: string; name: string }>).map((i) => i.name),
    tags: r.tags as string[],
    area_id: r.area_id as string | null,
    area_name: r.area_name as string,
    notes: truncateNotes(r.notes),
    icon: r.icon as string,
    color: r.color as string,
    short_code: r.short_code as string,
  }));

  const areas = areasResult.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
  }));

  return { bins, areas, availableColors: AVAILABLE_COLORS, availableIcons: AVAILABLE_ICONS };
}

/** Build context for the query (read-only) endpoint. */
export async function buildInventoryContext(locationId: string): Promise<InventoryContext> {
  const { binsResult, areasResult } = await fetchLocationBinsAndAreas(locationId);

  return {
    bins: binsResult.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      items: (r.items as Array<{ id: string; name: string }>).map((i) => i.name),
      tags: r.tags as string[],
      area_name: r.area_name as string,
      notes: truncateNotes(r.notes),
      short_code: r.short_code as string,
    })),
    areas: areasResult.rows.map((r) => ({
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
