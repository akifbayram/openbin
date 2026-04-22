import { Router } from 'express';
import { generateUuid, query, withTransaction } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove, verifyBinAccess } from '../lib/binAccess.js';
import { NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { logRouteActivity } from '../lib/routeHelpers.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const MAX_NAME_LEN = 200;
const MAX_BULK = 50;

// ── Bin-nested router (mounted at /api/bins) ─────────────────────────
export const binShoppingListRouter = Router();
binShoppingListRouter.use(authenticate);

// POST /api/bins/:id/shopping-list — bulk-add from a bin (undo-toast path)
binShoppingListRouter.post('/:id/shopping-list', asyncHandler(async (req, res) => {
  const { id: binId } = req.params;
  const userId = req.user!.id;
  const rawNames: unknown = req.body?.names;

  if (!Array.isArray(rawNames)) {
    throw new ValidationError('names must be an array');
  }
  if (rawNames.length === 0) {
    throw new ValidationError('names must not be empty');
  }
  if (rawNames.length > MAX_BULK) {
    throw new ValidationError(`names must contain at most ${MAX_BULK} items`);
  }
  const names: string[] = [];
  for (const n of rawNames) {
    if (typeof n !== 'string') throw new ValidationError('each name must be a string');
    const trimmed = n.trim();
    if (!trimmed) throw new ValidationError('names cannot be empty strings');
    if (trimmed.length > MAX_NAME_LEN) throw new ValidationError(`name too long (max ${MAX_NAME_LEN})`);
    names.push(trimmed);
  }

  const access = await verifyBinAccess(binId, userId);
  if (!access) throw new NotFoundError('Bin not found');

  await requireMemberOrAbove(access.locationId, userId, 'add to shopping list');

  const inserted = await withTransaction(async (txQuery) => {
    const rows: Array<{ id: string; name: string }> = [];
    for (const name of names) {
      const id = generateUuid();
      await txQuery(
        `INSERT INTO shopping_list_items (id, location_id, name, origin_bin_id, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, access.locationId, name, binId, userId, new Date().toISOString()],
      );
      rows.push({ id, name });
    }
    return rows;
  });

  // Fetch with JOIN so the client gets the full entry shape in one shot.
  const placeholders = inserted.map((_, i) => `$${i + 1}`).join(', ');
  const entries = await query<{
    id: string;
    location_id: string;
    name: string;
    origin_bin_id: string | null;
    origin_bin_name: string | null;
    origin_bin_icon: string | null;
    origin_bin_color: string | null;
    origin_bin_deleted_at: string | null;
    created_by: string;
    created_by_name: string;
    created_at: string;
  }>(
    `SELECT s.id, s.location_id, s.name, s.origin_bin_id,
            b.name AS origin_bin_name, b.icon AS origin_bin_icon, b.color AS origin_bin_color,
            b.deleted_at AS origin_bin_deleted_at,
            s.created_by, u.display_name AS created_by_name, s.created_at
     FROM shopping_list_items s
     LEFT JOIN bins b ON b.id = s.origin_bin_id
     JOIN users u ON u.id = s.created_by
     WHERE s.id IN (${placeholders})
     ORDER BY s.created_at ASC, s.id ASC`,
    inserted.map((e) => e.id),
  );

  logRouteActivity(req, {
    locationId: access.locationId,
    action: 'create',
    entityType: 'shopping_list',
    entityId: binId,
    entityName: access.name,
    changes: { added: { old: null, new: names } },
  });

  const mapped = entries.rows.map((r) => ({
    id: r.id,
    location_id: r.location_id,
    name: r.name,
    origin_bin_id: r.origin_bin_id,
    origin_bin_name: r.origin_bin_name,
    origin_bin_icon: r.origin_bin_icon,
    origin_bin_color: r.origin_bin_color,
    origin_bin_trashed: r.origin_bin_deleted_at !== null,
    created_by: r.created_by,
    created_by_name: r.created_by_name,
    created_at: r.created_at,
  }));

  res.status(201).json({ entries: mapped, count: mapped.length });
}));

export default binShoppingListRouter;

// ── Location-nested router (mounted at /api/locations) ────────────────
export const locationShoppingListRouter = Router();
locationShoppingListRouter.use(authenticate);

// GET /api/locations/:locationId/shopping-list
locationShoppingListRouter.get(
  '/:locationId/shopping-list',
  requireLocationMember('locationId'),
  asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    const userId = req.user!.id;

    const result = await query<{
      id: string;
      location_id: string;
      name: string;
      origin_bin_id: string | null;
      origin_bin_name: string | null;
      origin_bin_icon: string | null;
      origin_bin_color: string | null;
      origin_bin_deleted_at: string | null;
      created_by: string;
      created_by_name: string;
      created_at: string;
    }>(
      `SELECT s.id, s.location_id, s.name, s.origin_bin_id,
              b.name AS origin_bin_name, b.icon AS origin_bin_icon, b.color AS origin_bin_color,
              b.deleted_at AS origin_bin_deleted_at,
              s.created_by, u.display_name AS created_by_name, s.created_at
       FROM shopping_list_items s
       LEFT JOIN bins b ON b.id = s.origin_bin_id
       JOIN users u ON u.id = s.created_by
       WHERE s.location_id = $1
         AND (
           s.origin_bin_id IS NULL
           OR b.visibility = 'location'
           OR (b.visibility = 'private' AND b.created_by = $2)
         )
       ORDER BY s.created_at DESC`,
      [locationId, userId],
    );

    const rows = result.rows.map((r) => ({
      id: r.id,
      location_id: r.location_id,
      name: r.name,
      origin_bin_id: r.origin_bin_id,
      origin_bin_name: r.origin_bin_name,
      origin_bin_icon: r.origin_bin_icon,
      origin_bin_color: r.origin_bin_color,
      origin_bin_trashed: r.origin_bin_deleted_at !== null,
      created_by: r.created_by,
      created_by_name: r.created_by_name,
      created_at: r.created_at,
    }));

    res.json({ results: rows, count: rows.length });
  }),
);

// ── Flat router for entry-level ops (mounted at /api/shopping-list) ──
export const shoppingListRouter = Router();
shoppingListRouter.use(authenticate);

// POST /api/shopping-list/:id/purchase — mark bought (+ re-add to origin)
shoppingListRouter.post('/:id/purchase', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const entry = await query<{
    id: string;
    location_id: string;
    name: string;
    origin_bin_id: string | null;
  }>(
    'SELECT id, location_id, name, origin_bin_id FROM shopping_list_items WHERE id = $1',
    [id],
  );
  if (entry.rows.length === 0) throw new NotFoundError('Shopping list entry not found');

  const row = entry.rows[0];

  await requireMemberOrAbove(row.location_id, userId, 'mark shopping list item as bought');

  let restored: { binId: string; itemId: string; name: string } | null = null;
  let restoredBinName: string | null = null;
  if (row.origin_bin_id) {
    const bin = await query<{ id: string; name: string; deleted_at: string | null; visibility: string; created_by: string | null }>(
      'SELECT id, name, deleted_at, visibility, created_by FROM bins WHERE id = $1',
      [row.origin_bin_id],
    );
    const b = bin.rows[0];
    const binVisible = b
      && b.deleted_at === null
      && (b.visibility === 'location' || b.created_by === userId);
    if (binVisible) {
      restoredBinName = b.name;
      const posResult = await query<{ max_pos: number | null }>(
        'SELECT MAX(position) AS max_pos FROM bin_items WHERE bin_id = $1',
        [row.origin_bin_id],
      );
      const nextPos = (posResult.rows[0]?.max_pos ?? -1) + 1;
      const newItemId = generateUuid();
      const nowIso = new Date().toISOString();
      const originBinId = row.origin_bin_id;
      await withTransaction(async (txQuery) => {
        await txQuery(
          `INSERT INTO bin_items (id, bin_id, name, quantity, position, created_at, updated_at)
           VALUES ($1, $2, $3, NULL, $4, $5, $6)`,
          [newItemId, originBinId, row.name, nextPos, nowIso, nowIso],
        );
        await txQuery(`UPDATE bins SET updated_at = $1 WHERE id = $2`, [nowIso, originBinId]);
        await txQuery('DELETE FROM shopping_list_items WHERE id = $1', [id]);
      });
      restored = { binId: originBinId, itemId: newItemId, name: row.name };
    } else {
      // Origin bin is gone/invisible — just delete the entry.
      await query('DELETE FROM shopping_list_items WHERE id = $1', [id]);
    }
  } else {
    // No origin — just delete the entry.
    await query('DELETE FROM shopping_list_items WHERE id = $1', [id]);
  }

  logRouteActivity(req, {
    locationId: row.location_id,
    action: 'delete',
    entityType: 'shopping_list',
    entityId: id,
    entityName: row.name,
    changes: {
      purchased: {
        old: row.name,
        new: restoredBinName ? `→ ${restoredBinName}` : null,
      },
    },
  });

  if (restored) {
    logRouteActivity(req, {
      locationId: row.location_id,
      action: 'update',
      entityType: 'bin',
      entityId: restored.binId,
      entityName: row.name,
      changes: { items_added: { old: null, new: [row.name] } },
    });
  }

  res.json({ deleted: true, restored });
}));

// DELETE /api/shopping-list/:id — remove without purchase
shoppingListRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const entry = await query<{ id: string; location_id: string; name: string }>(
    'SELECT id, location_id, name FROM shopping_list_items WHERE id = $1',
    [id],
  );
  if (entry.rows.length === 0) throw new NotFoundError('Shopping list entry not found');

  const row = entry.rows[0];
  await requireMemberOrAbove(row.location_id, userId, 'remove shopping list item');

  await query('DELETE FROM shopping_list_items WHERE id = $1', [id]);

  logRouteActivity(req, {
    locationId: row.location_id,
    action: 'delete',
    entityType: 'shopping_list',
    entityId: id,
    entityName: row.name,
    changes: { removed: { old: row.name, new: null } },
  });

  res.json({ ok: true });
}));

// POST /api/locations/:locationId/shopping-list — manual add
locationShoppingListRouter.post(
  '/:locationId/shopping-list',
  requireLocationMember('locationId'),
  asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    const userId = req.user!.id;
    const rawName: unknown = req.body?.name;
    const rawOriginBinId: unknown = req.body?.originBinId;

    if (typeof rawName !== 'string') throw new ValidationError('name is required');
    const name = rawName.trim();
    if (!name) throw new ValidationError('name cannot be empty');
    if (name.length > MAX_NAME_LEN) throw new ValidationError(`name too long (max ${MAX_NAME_LEN})`);

    let originBinId: string | null = null;
    if (rawOriginBinId != null && rawOriginBinId !== '') {
      if (typeof rawOriginBinId !== 'string') throw new ValidationError('originBinId must be a string');
      const access = await verifyBinAccess(rawOriginBinId, userId);
      if (!access || access.locationId !== locationId) {
        throw new NotFoundError('Bin not found');
      }
      originBinId = rawOriginBinId;
    }

    await requireMemberOrAbove(locationId, userId, 'add to shopping list');

    const id = generateUuid();
    await query(
      `INSERT INTO shopping_list_items (id, location_id, name, origin_bin_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, locationId, name, originBinId, userId, new Date().toISOString()],
    );

    const result = await query<{
      id: string;
      location_id: string;
      name: string;
      origin_bin_id: string | null;
      origin_bin_name: string | null;
      origin_bin_icon: string | null;
      origin_bin_color: string | null;
      origin_bin_deleted_at: string | null;
      created_by: string;
      created_by_name: string;
      created_at: string;
    }>(
      `SELECT s.id, s.location_id, s.name, s.origin_bin_id,
              b.name AS origin_bin_name, b.icon AS origin_bin_icon, b.color AS origin_bin_color,
              b.deleted_at AS origin_bin_deleted_at,
              s.created_by, u.display_name AS created_by_name, s.created_at
       FROM shopping_list_items s
       LEFT JOIN bins b ON b.id = s.origin_bin_id
       JOIN users u ON u.id = s.created_by
       WHERE s.id = $1`,
      [id],
    );

    const row = result.rows[0];
    const entry = {
      id: row.id,
      location_id: row.location_id,
      name: row.name,
      origin_bin_id: row.origin_bin_id,
      origin_bin_name: row.origin_bin_name,
      origin_bin_icon: row.origin_bin_icon,
      origin_bin_color: row.origin_bin_color,
      origin_bin_trashed: row.origin_bin_deleted_at !== null,
      created_by: row.created_by,
      created_by_name: row.created_by_name,
      created_at: row.created_at,
    };

    logRouteActivity(req, {
      locationId,
      action: 'create',
      entityType: 'shopping_list',
      entityId: id,
      entityName: name,
      changes: { added: { old: null, new: name } },
    });

    res.status(201).json({ entry });
  }),
);
