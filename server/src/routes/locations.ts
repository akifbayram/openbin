import { Router } from 'express';
import crypto from 'crypto';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isLocationAdmin, verifyLocationMembership, getMemberRole } from '../lib/binAccess.js';
import { logActivity, computeChanges } from '../lib/activityLog.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from '../lib/httpErrors.js';
import { validateRetentionDays } from '../lib/validation.js';

const router = Router();

router.use(authenticate);

function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

// GET /api/locations — list user's locations
router.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT l.id, l.name, l.created_by, l.invite_code, l.activity_retention_days, l.trash_retention_days, l.app_name, l.term_bin, l.term_location, l.term_area, l.created_at, l.updated_at,
            lm.role,
            (SELECT COUNT(*) FROM location_members WHERE location_id = l.id) AS member_count,
            (SELECT COUNT(*) FROM areas WHERE location_id = l.id) AS area_count,
            (SELECT COUNT(*) FROM bins WHERE location_id = l.id AND deleted_at IS NULL) AS bin_count
     FROM locations l
     JOIN location_members lm ON lm.location_id = l.id AND lm.user_id = $1
     ORDER BY l.name COLLATE NOCASE ASC`,
    [req.user!.id]
  );

  const locations = result.rows.map(row => ({
    id: row.id,
    name: row.name,
    created_by: row.created_by,
    invite_code: row.invite_code,
    activity_retention_days: row.activity_retention_days,
    trash_retention_days: row.trash_retention_days,
    app_name: row.app_name,
    term_bin: row.term_bin,
    term_location: row.term_location,
    term_area: row.term_area,
    role: row.role,
    member_count: row.member_count,
    area_count: row.area_count,
    bin_count: row.bin_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  res.json({ results: locations, count: locations.length });
}));

// POST /api/locations — create location
router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Location name is required');
  }

  const inviteCode = generateInviteCode();
  const locationId = generateUuid();
  const locationResult = await query(
    'INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, $2, $3, $4) RETURNING id, name, invite_code, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, created_at, updated_at',
    [locationId, name.trim(), req.user!.id, inviteCode]
  );

  const location = locationResult.rows[0];

  // Auto-add creator as admin
  await query(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), location.id, req.user!.id, 'admin']
  );

  logActivity({
    locationId: location.id,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'create',
    entityType: 'location',
    entityId: location.id,
    entityName: location.name,
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
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
  const { name, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area } = req.body;

  if (!await isLocationAdmin(id, req.user!.id)) {
    throw new ForbiddenError('Only admins can update this location');
  }

  // At least one field must be provided
  if (name === undefined && activity_retention_days === undefined && trash_retention_days === undefined && app_name === undefined && term_bin === undefined && term_location === undefined && term_area === undefined) {
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
      if (value.length > 61) throw new ValidationError(`${field} must be at most 61 characters`);
    }
  }

  // Get old state for activity log
  const oldResult = await query('SELECT name, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area FROM locations WHERE id = $1', [id]);
  if (oldResult.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }
  const oldLoc = oldResult.rows[0];

  const setClauses: string[] = [`updated_at = datetime('now')`];
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

  params.push(id);

  const result = await query(
    `UPDATE locations SET ${setClauses.join(', ')} WHERE id = $${paramIdx}
     RETURNING id, name, created_by, invite_code, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, created_at, updated_at`,
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
  const changes = computeChanges(oldLoc, newObj, Object.keys(newObj));
  if (changes) {
    logActivity({
      locationId: id,
      userId: req.user!.id,
      userName: req.user!.username,
      action: 'update',
      entityType: 'location',
      entityId: id,
      entityName: location.name,
      changes,
      authMethod: req.authMethod,
      apiKeyId: req.apiKeyId,
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

  res.json({ message: 'Location deleted' });
}));

// POST /api/locations/join — join via invite code
router.post('/join', asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;

  if (!inviteCode || typeof inviteCode !== 'string') {
    throw new ValidationError('Invite code is required');
  }

  const locationResult = await query(
    'SELECT id, name, created_by, activity_retention_days, trash_retention_days, app_name, term_bin, term_location, term_area, created_at, updated_at FROM locations WHERE invite_code = $1',
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

  await query(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), location.id, req.user!.id, 'member']
  );

  logActivity({
    locationId: location.id,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'join',
    entityType: 'member',
    entityName: req.user!.username,
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
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
    role: 'member',
    member_count: memberCountResult.rows[0]?.member_count ?? 0,
    area_count: areaCountResult.rows[0]?.area_count ?? 0,
    created_at: location.created_at,
    updated_at: location.updated_at,
  });
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
            COALESCE(u.display_name, u.username) AS display_name
     FROM location_members lm
     LEFT JOIN users u ON u.id = lm.user_id
     WHERE lm.location_id = $1
     ORDER BY lm.joined_at ASC`,
    [locationId]
  );

  res.json({ results: result.rows, count: result.rows.length });
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

  const action = requesterId === userId ? 'leave' : 'remove_member';
  logActivity({
    locationId: id,
    userId: req.user!.id,
    userName: req.user!.username,
    action,
    entityType: 'member',
    entityName: removedUsername,
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
  });

  res.json({ message: 'Member removed' });
}));

// PUT /api/locations/:id/members/:userId/role — change member role (admin only)
router.put('/:id/members/:userId/role', asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const { role } = req.body;

  if (!role || !['admin', 'member'].includes(role)) {
    throw new ValidationError('Role must be "admin" or "member"');
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
  if (targetRole === 'admin' && role === 'member') {
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

  logActivity({
    locationId: id,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'change_role',
    entityType: 'member',
    entityName: targetUsername,
    changes: { role: { old: targetRole, new: role } },
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
  });

  res.json({ message: `Role updated to ${role}` });
}));

// POST /api/locations/:id/regenerate-invite — new invite code (admin only)
router.post('/:id/regenerate-invite', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!await isLocationAdmin(id, req.user!.id)) {
    throw new ForbiddenError('Only admins can regenerate invite codes');
  }

  const newCode = generateInviteCode();
  const result = await query(
    `UPDATE locations SET invite_code = $1, updated_at = datetime('now') WHERE id = $2 RETURNING invite_code`,
    [newCode, id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }

  logActivity({
    locationId: id,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'regenerate_invite',
    entityType: 'location',
    entityId: id,
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
  });

  res.json({ inviteCode: result.rows[0].invite_code });
}));

export default router;
