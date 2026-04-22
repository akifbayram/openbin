import { Router } from 'express';
import { d, generateUuid, query, withTransaction } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove, verifyBinAccess } from '../lib/binAccess.js';
import { validateBulkIds } from '../lib/bulkValidation.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
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
    'SELECT name FROM bin_items WHERE id = $1 AND bin_id = $2 AND deleted_at IS NULL',
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

  // Verify checkout belongs to the bin in the URL (access was checked via verifyBinAccess above)
  if (checkoutRow.origin_bin_id !== binId) {
    throw new NotFoundError('Item is not checked out');
  }

  // Validate targetBinId belongs to same location and user has access
  let returnBinId = checkoutRow.origin_bin_id;
  if (targetBinId && targetBinId !== checkoutRow.origin_bin_id) {
    const targetAccess = await verifyBinAccess(targetBinId, userId);
    if (!targetAccess || targetAccess.locationId !== access.locationId) {
      throw new NotFoundError('Target bin not found in this location');
    }
    await requireMemberOrAbove(targetAccess.locationId, userId, 'return items to target bin');
    returnBinId = targetBinId;
  }

  // Close the checkout
  await query(
    `UPDATE item_checkouts SET returned_at = ${d.now()}, returned_by = $1, return_bin_id = $2 WHERE id = $3`,
    [userId, returnBinId, checkoutRow.id]
  );

  // Get item name for activity logging (used in both branches)
  const itemResult = await query<{ name: string }>('SELECT name FROM bin_items WHERE id = $1 AND deleted_at IS NULL', [itemId]);
  const itemName = itemResult.rows[0]?.name ?? 'Unknown item';

  // If returning to a different bin, move the item
  if (returnBinId !== checkoutRow.origin_bin_id) {
    const maxResult = await query<{ max_pos: number | null }>(
      'SELECT MAX(position) as max_pos FROM bin_items WHERE bin_id = $1 AND deleted_at IS NULL',
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
    item_name: string;
    origin_bin_id: string;
    location_id: string;
    checked_out_by: string;
    checked_out_by_name: string;
    checked_out_at: string;
  }>(
    `SELECT ic.*, bi.name AS item_name, u.display_name AS checked_out_by_name
     FROM item_checkouts ic
     JOIN bin_items bi ON bi.id = ic.item_id
     JOIN users u ON u.id = ic.checked_out_by
     WHERE ic.origin_bin_id = $1 AND ic.returned_at IS NULL AND bi.deleted_at IS NULL
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
    origin_bin_icon: string;
    origin_bin_color: string;
    location_id: string;
    checked_out_by: string;
    checked_out_by_name: string;
    checked_out_at: string;
  }>(
    `SELECT ic.*, bi.name AS item_name, b.name AS origin_bin_name, b.icon AS origin_bin_icon, b.color AS origin_bin_color, u.display_name AS checked_out_by_name
     FROM item_checkouts ic
     JOIN bin_items bi ON bi.id = ic.item_id
     JOIN bins b ON b.id = ic.origin_bin_id
     JOIN users u ON u.id = ic.checked_out_by
     WHERE ic.location_id = $1 AND ic.returned_at IS NULL AND bi.deleted_at IS NULL
     ORDER BY ic.checked_out_at DESC`,
    [locationId]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

// POST /api/locations/:locationId/checkouts/bulk-return — return N items
locationCheckoutsRouter.post(
  '/:locationId/checkouts/bulk-return',
  requireLocationMember('locationId'),
  asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    const { checkoutIds, targetBinId } = req.body ?? {};
    const validIds = validateBulkIds(checkoutIds, 'checkoutIds');
    if (targetBinId !== undefined && (typeof targetBinId !== 'string' || targetBinId.length === 0)) {
      throw new ValidationError('targetBinId must be a non-empty string when provided');
    }
    await requireMemberOrAbove(locationId, req.user!.id, 'bulk-return checkouts');

    const { returned, errors } = await withTransaction(async (txQuery) => {
      let targetRow: { id: string; location_id: string; name: string } | null = null;
      if (targetBinId) {
        const tg = await txQuery<{ id: string; location_id: string; name: string }>(
          `SELECT id, location_id, name FROM bins WHERE id = $1 AND deleted_at IS NULL`,
          [targetBinId],
        );
        if (tg.rows.length === 0 || tg.rows[0].location_id !== locationId) {
          throw new NotFoundError('Target bin not found in this location');
        }
        targetRow = tg.rows[0];
      }

      // Find active checkouts in this location matching the requested IDs
      const placeholders = validIds.map((_, i) => `$${i + 2}`).join(', ');
      const active = await txQuery<{ id: string; item_id: string; origin_bin_id: string; location_id: string }>(
        `SELECT id, item_id, origin_bin_id, location_id
           FROM item_checkouts
          WHERE returned_at IS NULL
            AND location_id = $1
            AND id IN (${placeholders})`,
        [locationId, ...validIds],
      );
      const activeSet = new Set(active.rows.map((r) => r.id));
      const errs: Array<{ id: string; reason: string }> = [];
      for (const id of validIds) if (!activeSet.has(id)) errs.push({ id, reason: 'NOT_FOUND' });

      if (active.rows.length === 0) return { returned: 0, errors: errs };

      const affectedBinIds = new Set<string>();
      let nextPos = 0;
      if (targetRow) {
        const maxRes = await txQuery<{ max_pos: number | null }>(
          `SELECT MAX(position) AS max_pos FROM bin_items WHERE bin_id = $1`,
          [targetRow.id],
        );
        nextPos = (maxRes.rows[0]?.max_pos ?? -1) + 1;
      }

      let returnedCount = 0;
      for (const co of active.rows) {
        const returnBinId = targetRow?.id ?? co.origin_bin_id;
        if (targetRow) {
          await txQuery(
            `UPDATE bin_items SET bin_id = $1, position = $2 WHERE id = $3`,
            [targetRow.id, nextPos++, co.item_id],
          );
        }
        const upd = await txQuery<{ id: string }>(
          `UPDATE item_checkouts
              SET returned_at = ${d.now()}, returned_by = $1, return_bin_id = $2
            WHERE id = $3 AND returned_at IS NULL
          RETURNING id`,
          [req.user!.id, returnBinId, co.id],
        );
        if (upd.rows.length > 0) {
          returnedCount += 1;
          affectedBinIds.add(co.origin_bin_id);
          affectedBinIds.add(returnBinId);
        }
      }

      // Touch bins
      const ids = [...affectedBinIds];
      if (ids.length > 0) {
        const ph = ids.map((_, i) => `$${i + 1}`).join(', ');
        await txQuery(`UPDATE bins SET updated_at = ${d.now()} WHERE id IN (${ph})`, ids);
      }

      return { returned: returnedCount, errors: errs };
    });

    logRouteActivity(req, {
      entityType: 'checkout',
      locationId,
      action: 'bulk_return',
      entityId: undefined,
      entityName: undefined,
      changes: { counts: { old: null, new: { affected: returned, targetBinId: targetBinId ?? null } } },
    });

    res.json({ returned, errors });
  }),
);
