import { Router } from 'express';
import { d, generateUuid, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove, verifyBinAccess } from '../lib/binAccess.js';
import { ConflictError, NotFoundError } from '../lib/httpErrors.js';
import { logRouteActivity } from '../lib/routeHelpers.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const router = Router();

router.use(authenticate);

// POST /api/bins/:id/items/:itemId/checkout — check out an item
router.post('/:id/items/:itemId/checkout', asyncHandler(async (req, res) => {
  const { id: binId, itemId } = req.params;
  const userId = req.user!.id;

  const access = await verifyBinAccess(binId, userId);
  if (!access) throw new NotFoundError('Bin not found');

  await requireMemberOrAbove(access.locationId, userId, 'check out items');

  // Verify item exists in this bin
  const itemResult = await query<{ name: string }>(
    'SELECT name FROM bin_items WHERE id = $1 AND bin_id = $2',
    [itemId, binId]
  );
  if (itemResult.rows.length === 0) {
    throw new NotFoundError('Item not found');
  }

  // Check for active checkout
  const existing = await query(
    'SELECT id FROM item_checkouts WHERE item_id = $1 AND returned_at IS NULL',
    [itemId]
  );
  if (existing.rows.length > 0) {
    throw new ConflictError('Item is already checked out');
  }

  const checkoutId = generateUuid();
  await query(
    `INSERT INTO item_checkouts (id, item_id, origin_bin_id, location_id, checked_out_by, checked_out_at)
     VALUES ($1, $2, $3, $4, $5, ${d.now()})`,
    [checkoutId, itemId, binId, access.locationId, userId]
  );

  const checkout = await query<{
    id: string;
    item_id: string;
    origin_bin_id: string;
    location_id: string;
    checked_out_by: string;
    checked_out_at: string;
    returned_at: string | null;
    returned_by: string | null;
    return_bin_id: string | null;
  }>(
    'SELECT * FROM item_checkouts WHERE id = $1',
    [checkoutId]
  );

  logRouteActivity(req, {
    locationId: access.locationId,
    action: 'update',
    entityType: 'bin',
    entityId: binId,
    entityName: access.name,
    changes: { item_checked_out: { old: null, new: itemResult.rows[0].name } },
  });

  res.status(201).json({ checkout: checkout.rows[0] });
}));

// POST /api/bins/:id/items/:itemId/return — return a checked-out item
router.post('/:id/items/:itemId/return', asyncHandler(async (req, res) => {
  const { id: binId, itemId } = req.params;
  const { targetBinId } = req.body ?? {};
  const userId = req.user!.id;

  const access = await verifyBinAccess(binId, userId);
  if (!access) throw new NotFoundError('Bin not found');

  await requireMemberOrAbove(access.locationId, userId, 'return items');

  // Find active checkout
  const activeCheckout = await query<{
    id: string;
    origin_bin_id: string;
  }>(
    'SELECT id, origin_bin_id FROM item_checkouts WHERE item_id = $1 AND returned_at IS NULL',
    [itemId]
  );
  if (activeCheckout.rows.length === 0) {
    throw new NotFoundError('Item is not checked out');
  }

  const checkoutRow = activeCheckout.rows[0];
  const returnBinId = targetBinId || checkoutRow.origin_bin_id;

  // Close the checkout
  await query(
    `UPDATE item_checkouts SET returned_at = ${d.now()}, returned_by = $1, return_bin_id = $2 WHERE id = $3`,
    [userId, returnBinId, checkoutRow.id]
  );

  // Get item name for activity logging (used in both branches)
  const itemResult = await query<{ name: string }>('SELECT name FROM bin_items WHERE id = $1', [itemId]);
  const itemName = itemResult.rows[0]?.name ?? 'Unknown item';

  // If returning to a different bin, move the item
  if (returnBinId !== checkoutRow.origin_bin_id) {
    const maxResult = await query<{ max_pos: number | null }>(
      'SELECT MAX(position) as max_pos FROM bin_items WHERE bin_id = $1',
      [returnBinId]
    );
    const nextPos = (maxResult.rows[0]?.max_pos ?? -1) + 1;

    await query(
      'UPDATE bin_items SET bin_id = $1, position = $2 WHERE id = $3',
      [returnBinId, nextPos, itemId]
    );

    const [, targetBinResult] = await Promise.all([
      query(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [checkoutRow.origin_bin_id]),
      query<{ name: string }>('SELECT name FROM bins WHERE id = $1', [returnBinId]),
    ]);
    await query(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [returnBinId]);

    logRouteActivity(req, {
      locationId: access.locationId,
      action: 'update',
      entityType: 'bin',
      entityId: checkoutRow.origin_bin_id,
      entityName: access.name,
      changes: { item_returned_to: { old: null, new: targetBinResult.rows[0]?.name } },
    });
    logRouteActivity(req, {
      locationId: access.locationId,
      action: 'update',
      entityType: 'bin',
      entityId: returnBinId,
      entityName: targetBinResult.rows[0]?.name,
      changes: { item_received: { old: null, new: itemName } },
    });
  } else {
    logRouteActivity(req, {
      locationId: access.locationId,
      action: 'update',
      entityType: 'bin',
      entityId: binId,
      entityName: access.name,
      changes: { item_returned: { old: null, new: itemName } },
    });
  }

  // Fetch updated checkout record
  const updated = await query<{
    id: string;
    item_id: string;
    origin_bin_id: string;
    location_id: string;
    checked_out_by: string;
    checked_out_at: string;
    returned_at: string | null;
    returned_by: string | null;
    return_bin_id: string | null;
  }>(
    'SELECT * FROM item_checkouts WHERE id = $1',
    [checkoutRow.id]
  );

  res.json({ checkout: updated.rows[0] });
}));

// GET /api/bins/:id/checkouts — list active checkouts for a bin
router.get('/:id/checkouts', asyncHandler(async (req, res) => {
  const { id: binId } = req.params;
  const userId = req.user!.id;

  const access = await verifyBinAccess(binId, userId);
  if (!access) throw new NotFoundError('Bin not found');

  const result = await query<{
    id: string;
    item_id: string;
    origin_bin_id: string;
    location_id: string;
    checked_out_by: string;
    checked_out_by_name: string;
    checked_out_at: string;
  }>(
    `SELECT ic.*, u.display_name AS checked_out_by_name
     FROM item_checkouts ic
     JOIN users u ON u.id = ic.checked_out_by
     WHERE ic.origin_bin_id = $1 AND ic.returned_at IS NULL
     ORDER BY ic.checked_out_at DESC`,
    [binId]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

export default router;

// Location-wide checkouts router
export const locationCheckoutsRouter = Router();

locationCheckoutsRouter.use(authenticate);

// GET /api/locations/:locationId/checkouts — active checkouts across location
locationCheckoutsRouter.get('/:locationId/checkouts', requireLocationMember('locationId'), asyncHandler(async (req, res) => {
  const { locationId } = req.params;

  const result = await query<{
    id: string;
    item_id: string;
    item_name: string;
    origin_bin_id: string;
    origin_bin_name: string;
    location_id: string;
    checked_out_by: string;
    checked_out_by_name: string;
    checked_out_at: string;
  }>(
    `SELECT ic.*, bi.name AS item_name, b.name AS origin_bin_name, u.display_name AS checked_out_by_name
     FROM item_checkouts ic
     JOIN bin_items bi ON bi.id = ic.item_id
     JOIN bins b ON b.id = ic.origin_bin_id
     JOIN users u ON u.id = ic.checked_out_by
     WHERE ic.location_id = $1 AND ic.returned_at IS NULL
     ORDER BY ic.checked_out_at DESC`,
    [locationId]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));
