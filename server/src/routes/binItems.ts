import { Router } from 'express';
import { generateUuid, query } from '../db.js';
import { logActivity } from '../lib/activityLog.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { isLocationAdmin, verifyBinAccess } from '../lib/binAccess.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/** Verify user can edit a bin (must be bin creator or location admin) */
async function verifyBinEditAccess(binId: string, userId: string) {
  const access = await verifyBinAccess(binId, userId);
  if (!access) throw new NotFoundError('Bin not found');
  if (access.createdBy !== userId && !(await isLocationAdmin(access.locationId, userId))) {
    throw new ForbiddenError('Only the bin creator or a location admin can modify items');
  }
  return access;
}

router.use(authenticate);

// POST /api/bins/:id/items — add items to a bin
router.post('/:id/items', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('items array is required');
  }

  const access = await verifyBinEditAccess(id, req.user!.id);

  // Get max position
  const maxResult = await query<{ max_pos: number | null }>(
    'SELECT MAX(position) as max_pos FROM bin_items WHERE bin_id = $1',
    [id]
  );
  let nextPos = (maxResult.rows[0]?.max_pos ?? -1) + 1;

  const newItems: Array<{ id: string; name: string }> = [];
  for (const item of items) {
    const name = typeof item === 'string' ? item : (item as { name: string }).name;
    if (!name || !name.trim()) continue;
    const itemId = generateUuid();
    await query(
      'INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)',
      [itemId, id, name.trim(), nextPos++]
    );
    newItems.push({ id: itemId, name: name.trim() });
  }

  await query("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [id]);

  // Get bin name for activity log
  const binResult = await query<{ name: string }>('SELECT name FROM bins WHERE id = $1', [id]);
  logActivity({
    locationId: access.locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'update',
    entityType: 'bin',
    entityId: id,
    entityName: binResult.rows[0]?.name,
    changes: { items_added: { old: null, new: newItems.map((i) => i.name) } },
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
  });

  res.status(201).json({ items: newItems });
}));

// DELETE /api/bins/:id/items/:itemId — remove single item
router.delete('/:id/items/:itemId', asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;

  const access = await verifyBinEditAccess(id, req.user!.id);

  // Get item name before deleting
  const itemResult = await query<{ name: string }>(
    'SELECT name FROM bin_items WHERE id = $1 AND bin_id = $2',
    [itemId, id]
  );
  if (itemResult.rows.length === 0) {
    throw new NotFoundError('Item not found');
  }

  const itemName = itemResult.rows[0].name;
  await query('DELETE FROM bin_items WHERE id = $1 AND bin_id = $2', [itemId, id]);
  await query("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [id]);

  const binResult = await query<{ name: string }>('SELECT name FROM bins WHERE id = $1', [id]);
  logActivity({
    locationId: access.locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'update',
    entityType: 'bin',
    entityId: id,
    entityName: binResult.rows[0]?.name,
    changes: { items_removed: { old: [itemName], new: null } },
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
  });

  res.json({ success: true });
}));

// PUT /api/bins/:id/items/reorder — reorder items
router.put('/:id/items/reorder', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { item_ids } = req.body;

  if (!Array.isArray(item_ids) || item_ids.length === 0) {
    throw new ValidationError('item_ids array is required');
  }

  const _access = await verifyBinEditAccess(id, req.user!.id);

  for (let i = 0; i < item_ids.length; i++) {
    await query(
      'UPDATE bin_items SET position = $1 WHERE id = $2 AND bin_id = $3',
      [i, item_ids[i], id]
    );
  }

  res.json({ success: true });
}));

// PUT /api/bins/:id/items/:itemId — rename item
router.put('/:id/items/:itemId', asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('name is required');
  }

  const access = await verifyBinEditAccess(id, req.user!.id);

  const itemResult = await query<{ name: string }>(
    'SELECT name FROM bin_items WHERE id = $1 AND bin_id = $2',
    [itemId, id]
  );
  if (itemResult.rows.length === 0) {
    throw new NotFoundError('Item not found');
  }

  const oldName = itemResult.rows[0].name;
  await query(
    "UPDATE bin_items SET name = $1, updated_at = datetime('now') WHERE id = $2 AND bin_id = $3",
    [name.trim(), itemId, id]
  );
  await query("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [id]);

  const binResult = await query<{ name: string }>('SELECT name FROM bins WHERE id = $1', [id]);
  logActivity({
    locationId: access.locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'update',
    entityType: 'bin',
    entityId: id,
    entityName: binResult.rows[0]?.name,
    changes: { items_renamed: { old: oldName, new: name.trim() } },
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
  });

  res.json({ id: itemId, name: name.trim() });
}));

export default router;
