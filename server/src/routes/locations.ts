import crypto from 'node:crypto';
import { Router } from 'express';
import { d, generateUuid, query, withTransaction } from '../db.js';
import { computeChanges } from '../lib/activityLog.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getMemberRole, isLocationAdmin, verifyLocationMembership } from '../lib/binAccess.js';
import { ConflictError, ForbiddenError, NotFoundError, PlanRestrictedError, ValidationError } from '../lib/httpErrors.js';
import { createPasswordResetToken } from '../lib/passwordReset.js';
import { getEffectiveMemberRole, getFeatureMap, invalidateOverLimitCache, type PlanTier } from '../lib/planGate.js';
import { logRouteActivity } from '../lib/routeHelpers.js';
import { validateRetentionDays } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

// GET /api/locations — list user's locations
router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT l.id, l.name, l.created_by, l.invite_code, l.activity_retention_days, l.trash_retention_days, l.app_name, l.term_bin, l.term_location, l.term_area, l.default_join_role, l.created_at, l.updated_at,
            lm.role,
            (SELECT COUNT(*) FROM location_members WHERE location_id = l.id) AS member_count,
            (SELECT COUNT(*) FROM areas WHERE location_id = l.id) AS area_count,
            (SELECT COUNT(*) FROM bins WHERE location_id = l.id AND deleted_at IS NULL) AS bin_count
     FROM locations l
     JOIN location_members lm ON lm.location_id = l.id AND lm.user_id = $1
     ORDER BY l.name ${d.nocase()} ASC`,
    [req.user!.id]
  );

  const locationsWithEffectiveRoles = await Promise.all(
    result.rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      created_by: row.created_by,
      invite_code: row.role === 'admin' ? row.invite_code : undefined,
      activity_retention_days: row.activity_retention_days,
      trash_retention_days: row.trash_retention_days,
      app_name: row.app_name,
      term_bin: row.term_bin,
      term_location: row.term_location,
      term_area: row.term_area,
      default_join_role: row.default_join_role,
      role: await getEffectiveMemberRole(
        req.user!.id,
        row.id,
        row.role as 'admin' | 'member' | 'viewer',
        row.created_by,
      ),
      member_count: row.member_count,
      area_count: row.area_count,
      bin_count: row.bin_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
  );
  res.json({ results: locationsWithEffectiveRoles, count: locationsWithEffectiveRoles.length });
}));

// POST /api/locations — create location
router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Location name is required');
  }

  const locationId = generateUuid();
  const inviteCode = generateInviteCode();

  const location = await withTransaction(async (tx) => {
    // Check plan limits inside the transaction
    const planRow = await tx<{ plan: number }>('SELECT plan FROM users WHERE id = $1', [req.user!.id]);
    const features = planRow.rows.length > 0
      ? getFeatureMap(planRow.rows[0].plan as PlanTier)
      : getFeatureMap(1 as PlanTier); // PRO default

    if (features.maxLocations !== null) {
      const countResult = await tx<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM locations WHERE created_by = $1',
        [req.user!.id],
      );
      if (countResult.rows[0].cnt >= features.maxLocations) {
        throw new PlanRestrictedError(
          `Your plan allows a maximum of ${features.maxLocations} location${features.maxLocations === 1 ? '' : 's'}`,
        );
      }
    }

    await tx(
      'INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, $2, $3, $4)',
      [locationId, name.trim(), req.user!.id, inviteCode],
    );

    const locResult = await tx<Record<string, unknown>>(
      'SELECT id, name, invite_code, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, default_join_role, created_at, updated_at FROM locations WHERE id = $1',
      [locationId],
    );
    return locResult.rows[0];
  });

  invalidateOverLimitCache(req.user!.id);

  // Auto-add creator as admin
  await query(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), locationId, req.user!.id, 'admin']
  );

  logRouteActivity(req, {
    locationId,
    action: 'create',
    entityType: 'location',
    entityId: locationId,
    entityName: location.name as string,
  });

  res.status(201).json({
    id: location.id,
    name: location.name,
    created_by: req.user!.id,
    invite_code: location.invite_code,
    activity_retention_days: location.activity_retention_days,
    trash_retention_days: location.trash_retention_days,
    app_name: location.app_name,
    term_bin: location.term_bin,
    term_location: location.term_location,
    term_area: location.term_area,
    default_join_role: location.default_join_role,
    role: 'admin',
    member_count: 1,
    area_count: 0,
    created_at: location.created_at,
    updated_at: location.updated_at,
  });
}));

// PUT /api/locations/:id — update location (admin only)
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, default_join_role } = req.body;

  if (!await isLocationAdmin(id, req.user!.id)) {
    throw new ForbiddenError('Only admins can update this location');
  }

  // At least one field must be provided
  if (name === undefined && activity_retention_days === undefined && trash_retention_days === undefined && app_name === undefined && term_bin === undefined && term_location === undefined && term_area === undefined && default_join_role === undefined) {
    throw new ValidationError('At least one field must be provided');
  }

  if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length === 0)) {
    throw new ValidationError('Location name cannot be empty');
  }

  if (activity_retention_days !== undefined) {
    validateRetentionDays(activity_retention_days, 'Activity retention');
  }

  if (trash_retention_days !== undefined) {
    validateRetentionDays(trash_retention_days, 'Trash retention');
  }

  if (app_name !== undefined && (typeof app_name !== 'string' || app_name.trim().length === 0)) {
    throw new ValidationError('App name cannot be empty');
  }

  for (const [field, value] of [['term_bin', term_bin], ['term_location', term_location], ['term_area', term_area]] as const) {
    if (value !== undefined) {
      if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
      if (value.length > 30) throw new ValidationError(`${field} must be at most 30 characters`);
    }
  }

  if (default_join_role !== undefined && !['member', 'viewer'].includes(default_join_role)) {
    throw new ValidationError('default_join_role must be "member" or "viewer"');
  }

  // Get old state for activity log
  const oldResult = await query('SELECT name, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, default_join_role FROM locations WHERE id = $1', [id]);
  if (oldResult.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }
  const oldLoc = oldResult.rows[0];

  const setClauses: string[] = [`updated_at = ${d.now()}`];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    params.push(name.trim());
  }
  if (activity_retention_days !== undefined) {
    setClauses.push(`activity_retention_days = $${paramIdx++}`);
    params.push(Number(activity_retention_days));
  }
  if (trash_retention_days !== undefined) {
    setClauses.push(`trash_retention_days = $${paramIdx++}`);
    params.push(Number(trash_retention_days));
  }
  if (app_name !== undefined) {
    setClauses.push(`app_name = $${paramIdx++}`);
    params.push(app_name.trim());
  }
  if (term_bin !== undefined) {
    setClauses.push(`term_bin = $${paramIdx++}`);
    params.push(term_bin.trim());
  }
  if (term_location !== undefined) {
    setClauses.push(`term_location = $${paramIdx++}`);
    params.push(term_location.trim());
  }
  if (term_area !== undefined) {
    setClauses.push(`term_area = $${paramIdx++}`);
    params.push(term_area.trim());
  }
  if (default_join_role !== undefined) {
    setClauses.push(`default_join_role = $${paramIdx++}`);
    params.push(default_join_role);
  }

  params.push(id);

  const result = await query(
    `UPDATE locations SET ${setClauses.join(', ')} WHERE id = $${paramIdx}
     RETURNING id, name, created_by, invite_code, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, default_join_role, created_at, updated_at`,
    params
  );

  const location = result.rows[0];

  // Log changes
  const newObj: Record<string, unknown> = {};
  if (name !== undefined) newObj.name = name.trim();
  if (activity_retention_days !== undefined) newObj.activity_retention_days = Number(activity_retention_days);
  if (trash_retention_days !== undefined) newObj.trash_retention_days = Number(trash_retention_days);
  if (app_name !== undefined) newObj.app_name = app_name.trim();
  if (term_bin !== undefined) newObj.term_bin = term_bin.trim();
  if (term_location !== undefined) newObj.term_location = term_location.trim();
  if (term_area !== undefined) newObj.term_area = term_area.trim();
  if (default_join_role !== undefined) newObj.default_join_role = default_join_role;
  const changes = computeChanges(oldLoc, newObj, Object.keys(newObj));
  if (changes) {
    logRouteActivity(req, {
      locationId: id,
      action: 'update',
      entityType: 'location',
      entityId: id,
      entityName: location.name,
      changes,
    });
  }

  res.json({
    id: location.id,
    name: location.name,
    created_by: location.created_by,
    invite_code: location.invite_code,
    activity_retention_days: location.activity_retention_days,
    trash_retention_days: location.trash_retention_days,
    app_name: location.app_name,
    term_bin: location.term_bin,
    term_location: location.term_location,
    term_area: location.term_area,
    default_join_role: location.default_join_role,
    created_at: location.created_at,
    updated_at: location.updated_at,
  });
}));

// DELETE /api/locations/:id — delete location (admin only, cascades)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!await isLocationAdmin(id, req.user!.id)) {
    throw new ForbiddenError('Only admins can delete this location');
  }

  const result = await query('DELETE FROM locations WHERE id = $1 RETURNING id, name', [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }

  invalidateOverLimitCache(req.user!.id);

  res.json({ message: 'Location deleted' });
}));

// POST /api/locations/join — join via invite code
router.post('/join', asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;

  if (!inviteCode || typeof inviteCode !== 'string') {
    throw new ValidationError('Invite code is required');
  }

  const locationResult = await query(
    'SELECT id, name, created_by, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, default_join_role, created_at, updated_at FROM locations WHERE invite_code = $1',
    [inviteCode.trim()]
  );

  if (locationResult.rows.length === 0) {
    throw new NotFoundError('Invalid invite code');
  }

  const location = locationResult.rows[0];

  // Check if already a member
  if (await verifyLocationMembership(location.id, req.user!.id)) {
    throw new ConflictError('Already a member of this location');
  }

  const newMemberId = generateUuid();

  // Wrap member count check + INSERT in a transaction to prevent race conditions
  await withTransaction(async (tx) => {
    // Check plan limits — lookup owner's plan inside the transaction
    const planRow = await tx<{ plan: number }>('SELECT plan FROM users WHERE id = $1', [location.created_by]);
    const ownerFeatures = planRow.rows.length > 0
      ? getFeatureMap(planRow.rows[0].plan as PlanTier)
      : getFeatureMap(1 as PlanTier); // PRO default

    if (ownerFeatures.maxMembersPerLocation !== null) {
      const countResult = await tx<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM location_members WHERE location_id = $1',
        [location.id],
      );
      if (countResult.rows[0].cnt >= ownerFeatures.maxMembersPerLocation) {
        throw new PlanRestrictedError('This location has reached its member limit');
      }
    }

    await tx(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [newMemberId, location.id, req.user!.id, location.default_join_role],
    );
  });

  invalidateOverLimitCache(location.created_by);

  logRouteActivity(req, {
    locationId: location.id,
    action: 'join',
    entityType: 'member',
    entityName: req.user!.username,
  });

  // Get area count for the joined location
  const areaCountResult = await query(
    'SELECT COUNT(*) AS area_count FROM areas WHERE location_id = $1',
    [location.id]
  );
  const memberCountResult = await query(
    'SELECT COUNT(*) AS member_count FROM location_members WHERE location_id = $1',
    [location.id]
  );

  res.status(201).json({
    id: location.id,
    name: location.name,
    created_by: location.created_by,
    invite_code: '',
    activity_retention_days: location.activity_retention_days,
    trash_retention_days: location.trash_retention_days,
    app_name: location.app_name,
    term_bin: location.term_bin,
    term_location: location.term_location,
    term_area: location.term_area,
    role: location.default_join_role,
    member_count: memberCountResult.rows[0]?.member_count ?? 0,
    area_count: areaCountResult.rows[0]?.area_count ?? 0,
    created_at: location.created_at,
    updated_at: location.updated_at,
  });
}));

// GET /api/locations/:id/stats — dashboard aggregate stats
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const locationId = req.params.id;

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  const result = await query<{
    total_bins: number;
    total_items: number;
    total_areas: number;
    needs_organizing: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM bins WHERE location_id = $1 AND deleted_at IS NULL) AS total_bins,
      (SELECT COALESCE(SUM(item_cnt), 0) FROM (
        SELECT COUNT(*) AS item_cnt FROM bin_items
        WHERE bin_id IN (SELECT id FROM bins WHERE location_id = $1 AND deleted_at IS NULL)
      )) AS total_items,
      (SELECT COUNT(*) FROM areas WHERE location_id = $1) AS total_areas,
      (SELECT COUNT(*) FROM bins b WHERE b.location_id = $1 AND b.deleted_at IS NULL
        AND b.area_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id)
        AND (b.tags IS NULL OR b.tags = '[]')
      ) AS needs_organizing`,
    [locationId],
  );

  res.json(result.rows[0]);
}));

// GET /api/locations/:id/members — list members
router.get('/:id/members', asyncHandler(async (req, res) => {
  const locationId = req.params.id;

  // Verify requester is a member
  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  const result = await query(
    `SELECT lm.id, lm.location_id, lm.user_id, lm.role, lm.joined_at,
            COALESCE(u.display_name, u.username) AS display_name,
            u.username
     FROM location_members lm
     LEFT JOIN users u ON u.id = lm.user_id
     WHERE lm.location_id = $1
     ORDER BY lm.joined_at ASC`,
    [locationId]
  );

  const locOwner = await query<{ created_by: string }>(
    'SELECT created_by FROM locations WHERE id = $1',
    [locationId]
  );
  const ownerCreatedBy = locOwner.rows[0]?.created_by ?? '';

  const membersWithRoles = await Promise.all(
    result.rows.map(async (m: Record<string, unknown>) => ({
      ...m,
      role: await getEffectiveMemberRole(
        m.user_id as string,
        locationId,
        m.role as 'admin' | 'member' | 'viewer',
        ownerCreatedBy,
      ),
    }))
  );

  res.json({ results: membersWithRoles, count: membersWithRoles.length });
}));

// DELETE /api/locations/:id/members/:userId — remove member
router.delete('/:id/members/:userId', asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const requesterId = req.user!.id;

  // Check membership
  const role = await getMemberRole(id, requesterId);
  if (!role) {
    throw new ForbiddenError('Not a member of this location');
  }

  const isAdmin = role === 'admin';

  // Members can only remove themselves; admins can remove anyone
  if (!isAdmin && requesterId !== userId) {
    throw new ForbiddenError('Only admins can remove other members');
  }

  // If an admin is leaving, check they're not the last admin
  if (isAdmin && requesterId === userId) {
    const adminCount = await query(
      "SELECT COUNT(*) AS cnt FROM location_members WHERE location_id = $1 AND role = 'admin'",
      [id]
    );
    if (adminCount.rows[0].cnt <= 1) {
      throw new ValidationError('Cannot leave as the last admin. Promote another member first.');
    }
  }

  // Get username for activity log
  const userResult = await query('SELECT username FROM users WHERE id = $1', [userId]);
  const removedUsername = userResult.rows[0]?.username ?? 'unknown';

  const result = await query(
    'DELETE FROM location_members WHERE location_id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Member not found');
  }

  const ownerRow = await query<{ created_by: string }>('SELECT created_by FROM locations WHERE id = $1', [id]);
  if (ownerRow.rows[0]) invalidateOverLimitCache(ownerRow.rows[0].created_by);

  const action = requesterId === userId ? 'leave' : 'remove_member';
  logRouteActivity(req, {
    locationId: id,
    action,
    entityType: 'member',
    entityName: removedUsername,
  });

  res.json({ message: 'Member removed' });
}));

// PUT /api/locations/:id/members/:userId/role — change member role (admin only)
router.put('/:id/members/:userId/role', asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const { role } = req.body;

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    throw new ValidationError('Role must be "admin", "member", or "viewer"');
  }

  // Requester must be admin
  if (!await isLocationAdmin(id, req.user!.id)) {
    throw new ForbiddenError('Only admins can change member roles');
  }

  // Target must be a member
  const targetRole = await getMemberRole(id, userId);
  if (!targetRole) {
    throw new NotFoundError('Member not found');
  }

  if (targetRole === role) {
    res.json({ message: 'Role unchanged' });
    return;
  }

  // Last-admin guard: prevent demoting the sole admin
  if (targetRole === 'admin' && role !== 'admin') {
    const adminCount = await query(
      "SELECT COUNT(*) AS cnt FROM location_members WHERE location_id = $1 AND role = 'admin'",
      [id]
    );
    if (adminCount.rows[0].cnt <= 1) {
      throw new ValidationError('Cannot demote the last admin. Promote another member first.');
    }
  }

  await query(
    'UPDATE location_members SET role = $1 WHERE location_id = $2 AND user_id = $3',
    [role, id, userId]
  );

  // Get username for activity log
  const userResult = await query('SELECT username FROM users WHERE id = $1', [userId]);
  const targetUsername = userResult.rows[0]?.username ?? 'unknown';

  logRouteActivity(req, {
    locationId: id,
    action: 'change_role',
    entityType: 'member',
    entityName: targetUsername,
    changes: { role: { old: targetRole, new: role } },
  });

  res.json({ message: `Role updated to ${role}` });
}));

// POST /api/locations/:id/members/:userId/reset-password — admin generates reset token
router.post('/:id/members/:userId/reset-password', asyncHandler(async (req, res) => {
  const { id, userId } = req.params;

  // Requester must be admin
  if (!await isLocationAdmin(id, req.user!.id)) {
    throw new ForbiddenError('Only admins can reset member passwords');
  }

  // Target must be a member of this location
  const targetRole = await getMemberRole(id, userId);
  if (!targetRole) {
    throw new NotFoundError('Member not found');
  }

  // Cannot reset your own password this way (use profile password change)
  if (userId === req.user!.id) {
    throw new ValidationError('Use the profile page to change your own password');
  }

  const { rawToken, expiresAt } = await createPasswordResetToken(userId, req.user!.id);

  // Get username for activity log
  const userResult = await query('SELECT username FROM users WHERE id = $1', [userId]);
  const targetUsername = userResult.rows[0]?.username ?? 'unknown';

  logRouteActivity(req, {
    locationId: id,
    action: 'reset_password',
    entityType: 'member',
    entityId: userId,
    entityName: targetUsername,
  });

  res.json({ token: rawToken, expiresAt });
}));

// POST /api/locations/:id/regenerate-invite — new invite code (admin only)
router.post('/:id/regenerate-invite', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!await isLocationAdmin(id, req.user!.id)) {
    throw new ForbiddenError('Only admins can regenerate invite codes');
  }

  const newCode = generateInviteCode();
  const result = await query(
    `UPDATE locations SET invite_code = $1, updated_at = ${d.now()} WHERE id = $2 RETURNING invite_code`,
    [newCode, id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }

  logRouteActivity(req, {
    locationId: id,
    action: 'regenerate_invite',
    entityType: 'location',
    entityId: id,
  });

  res.json({ inviteCode: result.rows[0].invite_code });
}));

export default router;
