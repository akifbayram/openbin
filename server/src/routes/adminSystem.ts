import { Router } from 'express';
import { getDialect } from '../db/dialect.js';
import { generateUuid, query } from '../db.js';
import { logAdminAction } from '../lib/adminAudit.js';
import { isValidRole } from '../lib/adminHelpers.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { authenticate } from '../middleware/auth.js';
import { setMaintenanceMode } from '../middleware/maintenance.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// ---------------------------------------------------------------------------
// MAINTENANCE MODE
// ---------------------------------------------------------------------------

// GET /maintenance
router.get('/maintenance', asyncHandler(async (_req, res) => {
  const result = await query<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'maintenance_mode'",
  );

  if (!result.rows[0]) {
    res.json({ enabled: false, message: '' });
    return;
  }

  const data = JSON.parse(result.rows[0].value) as { enabled: boolean; message?: string };
  res.json({ enabled: !!data.enabled, message: data.message ?? '' });
}));

// POST /maintenance
router.post('/maintenance', asyncHandler(async (req, res) => {
  const { enabled, message } = req.body;

  if (typeof enabled !== 'boolean') {
    throw new ValidationError('enabled must be a boolean');
  }

  const payload = JSON.stringify({ enabled, message: message ?? '' });

  await query(
    "INSERT INTO settings (key, value) VALUES ('maintenance_mode', $1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [payload],
  );

  setMaintenanceMode(enabled, message ?? '');

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.username,
    action: 'toggle_maintenance',
    targetType: 'system',
    details: { enabled, message: message ?? '' },
  });

  res.json({ enabled, message: message ?? '' });
}));

// ---------------------------------------------------------------------------
// ANNOUNCEMENTS
// ---------------------------------------------------------------------------

// GET /announcements
router.get('/announcements', asyncHandler(async (_req, res) => {
  const result = await query<{
    id: string; text: string; type: string; dismissible: number | boolean;
    active: number | boolean; expires_at: string | null; created_by: string | null;
    created_at: string;
  }>('SELECT * FROM announcements ORDER BY created_at DESC');

  const results = result.rows.map((row) => ({
    id: row.id,
    text: row.text,
    type: row.type,
    dismissible: !!row.dismissible,
    active: !!row.active,
    expiresAt: row.expires_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
  }));

  res.json({ results, count: results.length });
}));

// POST /announcements
router.post('/announcements', asyncHandler(async (req, res) => {
  const { text, type, dismissible, expiresAt } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new ValidationError('text is required');
  }

  const announcementType = type ?? 'info';
  if (!['info', 'warning', 'critical'].includes(announcementType)) {
    throw new ValidationError('type must be one of: info, warning, critical');
  }

  const isDismissible = dismissible !== undefined ? !!dismissible : true;

  // Deactivate all existing active announcements
  await query('UPDATE announcements SET active = $1', [false]);

  const id = generateUuid();

  await query(
    `INSERT INTO announcements (id, text, type, dismissible, active, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      text.trim(),
      announcementType,
      isDismissible,
      true,
      expiresAt ?? null,
      req.user!.id,
    ],
  );

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.username,
    action: 'create_announcement',
    targetType: 'announcement',
    targetId: id,
    details: { text: text.trim(), type: announcementType },
  });

  res.status(201).json({
    id,
    text: text.trim(),
    type: announcementType,
    dismissible: isDismissible,
    active: true,
    expiresAt: expiresAt ?? null,
    createdBy: req.user!.id,
    createdAt: new Date().toISOString(),
  });
}));

// DELETE /announcements/:id
router.delete('/announcements/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    'UPDATE announcements SET active = $1 WHERE id = $2',
    [false, id],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Announcement not found');
  }

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.username,
    action: 'delete_announcement',
    targetType: 'announcement',
    targetId: id,
  });

  res.json({ message: 'Announcement deactivated' });
}));

// ---------------------------------------------------------------------------
// SYSTEM HEALTH
// ---------------------------------------------------------------------------

// GET /health
router.get('/health', asyncHandler(async (_req, res) => {
  // Database size
  let dbSizeBytes = 0;
  if (getDialect() === 'sqlite') {
    const sizeResult = await query<{ db_size: number }>(
      'SELECT (page_count * page_size) as db_size FROM pragma_page_count(), pragma_page_size()',
    );
    dbSizeBytes = sizeResult.rows[0]?.db_size ?? 0;
  } else {
    const sizeResult = await query<{ db_size: string }>(
      'SELECT pg_database_size(current_database()) as db_size',
    );
    dbSizeBytes = parseInt(sizeResult.rows[0]?.db_size ?? '0', 10);
  }

  // User counts
  const userResult = await query<{ total: number; deleted: number; suspended: number }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted,
       SUM(CASE WHEN suspended_at IS NOT NULL THEN 1 ELSE 0 END) as suspended
     FROM users`,
  );
  const { total, deleted, suspended } = userResult.rows[0];

  // Active sessions
  const sessionResult = await query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at > $1',
    [new Date().toISOString()],
  );

  res.json({
    dbSizeBytes,
    userCount: {
      total: total ?? 0,
      active: (total ?? 0) - (deleted ?? 0) - (suspended ?? 0),
      deleted: deleted ?? 0,
      suspended: suspended ?? 0,
    },
    activeSessions: sessionResult.rows[0].cnt ?? 0,
    uptime: process.uptime(),
  });
}));

// ---------------------------------------------------------------------------
// ADMIN AUDIT LOG
// ---------------------------------------------------------------------------

// GET /audit-log
router.get('/audit-log', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = (page - 1) * limit;

  const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
  const actorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : '';
  const targetType = typeof req.query.targetType === 'string' ? req.query.targetType.trim() : '';

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 0;
  const nextParam = () => `$${++paramIdx}`;

  if (action) {
    conditions.push(`action = ${nextParam()}`);
    params.push(action);
  }
  if (actorId) {
    conditions.push(`actor_id = ${nextParam()}`);
    params.push(actorId);
  }
  if (targetType) {
    conditions.push(`target_type = ${nextParam()}`);
    params.push(targetType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countResult, dataResult] = await Promise.all([
    query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM admin_audit_log ${whereClause}`,
      params,
    ),
    query<{
      id: string; actor_id: string; actor_name: string; action: string;
      target_type: string; target_id: string | null; target_name: string | null;
      details: string | null; created_at: string;
    }>(
      `SELECT id, actor_id, actor_name, action, target_type, target_id, target_name, details, created_at
       FROM admin_audit_log ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${nextParam()} OFFSET ${nextParam()}`,
      [...params, limit, offset],
    ),
  ]);

  const results = dataResult.rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id ?? null,
    targetName: row.target_name ?? null,
    details: row.details ? JSON.parse(row.details) : null,
    createdAt: row.created_at,
  }));

  res.json({ results, count: countResult.rows[0].cnt });
}));

// ---------------------------------------------------------------------------
// ADMIN LOCATIONS
// ---------------------------------------------------------------------------

// GET /locations
router.get('/locations', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params: unknown[] = [];
  if (q) {
    whereClause = 'WHERE LOWER(l.name) LIKE $1';
    params.push(`%${q.toLowerCase()}%`);
  }

  const [countResult, dataResult] = await Promise.all([
    query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM locations l ${whereClause}`,
      params,
    ),
    query<{
    id: string; name: string; owner_username: string | null; owner_display_name: string | null;
    member_count: number; bin_count: number; area_count: number; created_at: string;
  }>(
    `SELECT l.id, l.name,
       u.username AS owner_username,
       u.display_name AS owner_display_name,
       (SELECT COUNT(*) FROM location_members lm WHERE lm.location_id = l.id) AS member_count,
       (SELECT COUNT(*) FROM bins b WHERE b.location_id = l.id AND b.deleted_at IS NULL) AS bin_count,
       (SELECT COUNT(*) FROM areas a WHERE a.location_id = l.id) AS area_count,
       l.created_at
     FROM locations l
     LEFT JOIN users u ON l.created_by = u.id
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  ),
  ]);

  const results = dataResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerUsername: row.owner_username ?? null,
    ownerDisplayName: row.owner_display_name ?? null,
    memberCount: row.member_count ?? 0,
    binCount: row.bin_count ?? 0,
    areaCount: row.area_count ?? 0,
    createdAt: row.created_at,
  }));

  res.json({ results, count: countResult.rows[0].cnt });
}));

// POST /locations/:id/force-join
router.post('/locations/:id/force-join', asyncHandler(async (req, res) => {
  const locationId = req.params.id;
  const { userId, role } = req.body;

  if (!userId || typeof userId !== 'string') {
    throw new ValidationError('userId is required');
  }
  if (!isValidRole(role)) {
    throw new ValidationError('role must be one of: admin, member, viewer');
  }

  // Verify user exists
  const userResult = await query<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId]);
  if (!userResult.rows[0]) throw new NotFoundError('User not found');

  // Verify location exists
  const locationResult = await query<{ id: string; name: string }>(
    'SELECT id, name FROM locations WHERE id = $1',
    [locationId],
  );
  if (!locationResult.rows[0]) throw new NotFoundError('Location not found');

  const memberId = generateUuid();
  await query(
    `INSERT INTO location_members (id, location_id, user_id, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(location_id, user_id) DO UPDATE SET role = excluded.role`,
    [memberId, locationId, userId, role],
  );

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.username,
    action: 'force_join_location',
    targetType: 'location',
    targetId: locationId,
    targetName: locationResult.rows[0].name,
    details: { userId, role, locationId },
  });

  res.json({ message: 'User joined location' });
}));

// DELETE /locations/:locationId/members/:userId
router.delete('/locations/:locationId/members/:userId', asyncHandler(async (req, res) => {
  const { locationId, userId } = req.params;

  const result = await query(
    'DELETE FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Member not found');
  }

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.username,
    action: 'remove_member',
    targetType: 'location_member',
    targetId: userId,
    details: { locationId, userId },
  });

  res.json({ message: 'Member removed' });
}));

// PUT /locations/:locationId/members/:userId/role
router.put('/locations/:locationId/members/:userId/role', asyncHandler(async (req, res) => {
  const { locationId, userId } = req.params;
  const { role } = req.body;

  if (!isValidRole(role)) {
    throw new ValidationError('role must be one of: admin, member, viewer');
  }

  const result = await query(
    'UPDATE location_members SET role = $1 WHERE location_id = $2 AND user_id = $3',
    [role, locationId, userId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Member not found');
  }

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.username,
    action: 'change_member_role',
    targetType: 'location_member',
    targetId: userId,
    details: { locationId, userId, role },
  });

  res.json({ message: 'Role updated' });
}));

// ---------------------------------------------------------------------------
// ADMIN CONTENT (Global bin viewing)
// ---------------------------------------------------------------------------

// GET /bins
router.get('/bins', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE b.deleted_at IS NULL';
  const params: unknown[] = [];
  if (q) {
    whereClause += ' AND (LOWER(b.name) LIKE $1 OR LOWER(b.short_code) LIKE $1)';
    params.push(`%${q.toLowerCase()}%`);
  }

  const countResult = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM bins b ${whereClause}`,
    params,
  );

  const dataResult = await query<{
    id: string; name: string; short_code: string; location_name: string;
    owner_username: string | null; created_at: string; updated_at: string;
  }>(
    `SELECT b.id, b.name, b.short_code,
       l.name AS location_name,
       u.username AS owner_username,
       b.created_at, b.updated_at
     FROM bins b
     JOIN locations l ON b.location_id = l.id
     LEFT JOIN users u ON b.created_by = u.id
     ${whereClause}
     ORDER BY b.updated_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  const results = dataResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortCode: row.short_code,
    locationName: row.location_name,
    ownerUsername: row.owner_username ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  res.json({ results, count: countResult.rows[0].cnt });
}));

// GET /bins/:id
router.get('/bins/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const binResult = await query<{
    id: string; name: string; short_code: string; location_id: string;
    area_id: string | null; notes: string; tags: string; icon: string;
    color: string; card_style: string; visibility: string;
    created_by: string | null; created_at: string; updated_at: string;
    deleted_at: string | null; location_name: string; owner_username: string | null;
  }>(
    `SELECT b.*, l.name AS location_name, u.username AS owner_username
     FROM bins b
     JOIN locations l ON b.location_id = l.id
     LEFT JOIN users u ON b.created_by = u.id
     WHERE b.id = $1`,
    [id],
  );

  const bin = binResult.rows[0];
  if (!bin) throw new NotFoundError('Bin not found');

  const itemsResult = await query<{
    id: string; name: string; quantity: number | null; position: number;
  }>(
    'SELECT id, name, quantity, position FROM bin_items WHERE bin_id = $1 ORDER BY position',
    [id],
  );

  let tags: string[] = [];
  try {
    tags = JSON.parse(bin.tags);
  } catch { /* default to empty */ }

  res.json({
    id: bin.id,
    name: bin.name,
    shortCode: bin.short_code,
    locationId: bin.location_id,
    locationName: bin.location_name,
    areaId: bin.area_id ?? null,
    notes: bin.notes,
    tags,
    icon: bin.icon,
    color: bin.color,
    cardStyle: bin.card_style,
    visibility: bin.visibility,
    ownerUsername: bin.owner_username ?? null,
    createdBy: bin.created_by ?? null,
    createdAt: bin.created_at,
    updatedAt: bin.updated_at,
    deletedAt: bin.deleted_at ?? null,
    items: itemsResult.rows.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity ?? null,
      position: item.position,
    })),
  });
}));

export { router as adminSystemRoutes };
