import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import { generateUuid, getDb, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { firePasswordResetEmail } from '../lib/emailSender.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { notifyManagerUserUpdate } from '../lib/managerWebhook.js';
import { getCloudMetrics } from '../lib/metrics.js';
import { createPasswordResetToken } from '../lib/passwordReset.js';
import { isSelfHosted, Plan, type PlanTier, planLabel, SubStatus, type SubStatusType, subStatusLabel } from '../lib/planGate.js';
import { invalidatePlanRateLimit, metricsLimiter } from '../lib/rateLimiters.js';
import { validateDisplayName, validateEmail, validatePassword, validateUsername } from '../lib/validation.js';
import { authenticate, invalidateDeletedCache } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

function getAdminCount(): number {
  const db = getDb();
  return (db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_admin = 1').get() as { cnt: number }).cnt;
}

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/users — list all users (paginated, searchable)
router.get('/users', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params: unknown[] = [];
  if (q) {
    whereClause = 'WHERE (LOWER(u.username) LIKE $1 OR LOWER(u.email) LIKE $1 OR LOWER(u.display_name) LIKE $1)';
    params.push(`%${q.toLowerCase()}%`);
  }

  const countResult = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM users u ${whereClause}`,
    params,
  );

  const sortField = typeof req.query.sort === 'string' ? req.query.sort : '-created';
  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;

  const sortMap: Record<string, string> = {
    username: 'u.username',
    email: 'u.email',
    plan: 'u.plan',
    status: 'u.sub_status',
    created: 'u.created_at',
    bins: 'bin_count',
    locations: 'location_count',
    storage: 'photo_storage_bytes',
  };
  const orderCol = sortMap[field] || 'u.created_at';
  const orderDir = desc ? 'DESC' : 'ASC';

  const usersResult = await query(
    `SELECT u.id, u.username, u.display_name, u.email, u.is_admin, u.plan, u.sub_status, u.active_until, u.deleted_at, u.created_at,
       (SELECT COUNT(*) FROM bins b JOIN location_members lm ON b.location_id = lm.location_id WHERE lm.user_id = u.id AND b.deleted_at IS NULL) AS bin_count,
       (SELECT COUNT(DISTINCT lm.location_id) FROM location_members lm WHERE lm.user_id = u.id) AS location_count,
       (SELECT COALESCE(SUM(p.size), 0) FROM photos p WHERE p.created_by = u.id) AS photo_storage_bytes
     FROM users u ${whereClause}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  const results = usersResult.rows.map((u: any) => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    email: u.email || null,
    isAdmin: u.is_admin === 1,
    plan: planLabel(u.plan),
    status: subStatusLabel(u.sub_status),
    activeUntil: u.active_until || null,
    deletedAt: u.deleted_at || null,
    createdAt: u.created_at,
    binCount: u.bin_count ?? 0,
    locationCount: u.location_count ?? 0,
    photoStorageMb: Math.round((u.photo_storage_bytes ?? 0) / 1024 / 1024 * 10) / 10,
  }));

  res.json({ results, count: countResult.rows[0].cnt, adminCount: getAdminCount() });
}));

// POST /api/admin/users — create a new user (admin only)
router.post('/users', asyncHandler(async (req, res) => {
  const { username, password, displayName, email, isAdmin } = req.body;

  validateUsername(username);
  validatePassword(password);
  if (displayName !== undefined) validateDisplayName(displayName);
  if (email !== undefined && email !== '') validateEmail(email);

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const userId = generateUuid();

  let result: import('../db.js').QueryResult<Record<string, unknown>>;
  try {
    result = await query(
      `INSERT INTO users (id, username, password_hash, display_name, email, is_admin, plan, sub_status, active_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, username, display_name, email, is_admin, plan, sub_status, created_at`,
      [
        userId,
        username.toLowerCase(),
        passwordHash,
        displayName || username,
        email || null,
        isAdmin ? 1 : 0,
        Plan.PRO,
        isSelfHosted() ? SubStatus.ACTIVE : SubStatus.TRIAL,
        isSelfHosted()
          ? new Date(Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ]
    );
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ConflictError('Username already taken');
    }
    throw err;
  }

  const user = result.rows[0] as {
    id: string; username: string; display_name: string; email: string | null;
    is_admin: number; plan: PlanTier; sub_status: SubStatusType; created_at: string;
  };

  console.log(`[admin] User ${req.user!.username} created user ${username}`);

  res.status(201).json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    isAdmin: user.is_admin === 1,
    plan: planLabel(user.plan),
    status: subStatusLabel(user.sub_status),
    createdAt: user.created_at,
  });
}));

// GET /api/admin/users/:id — user detail with stats
router.get('/users/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const userId = req.params.id;

  const row = db.prepare(
    'SELECT id, username, display_name, email, is_admin, plan, sub_status, active_until, deleted_at, created_at, updated_at FROM users WHERE id = ?'
  ).get(userId) as {
    id: string; username: string; display_name: string; email: string | null;
    is_admin: number; plan: PlanTier; sub_status: SubStatusType;
    active_until: string | null; deleted_at: string | null; created_at: string; updated_at: string;
  } | undefined;

  if (!row) throw new NotFoundError('User not found');

  const locationCount = (db.prepare('SELECT COUNT(*) as cnt FROM locations WHERE created_by = ?').get(userId) as { cnt: number }).cnt;
  const binCount = (db.prepare('SELECT COUNT(*) as cnt FROM bins WHERE created_by = ? AND deleted_at IS NULL').get(userId) as { cnt: number }).cnt;
  const photoCount = (db.prepare('SELECT COUNT(*) as cnt FROM photos WHERE created_by = ?').get(userId) as { cnt: number }).cnt;
  const photoStorageBytes = (db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = ?').get(userId) as { total: number }).total;
  const apiKeyCount = (db.prepare('SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ? AND revoked_at IS NULL').get(userId) as { cnt: number }).cnt;
  const shareCount = (db.prepare('SELECT COUNT(*) as cnt FROM bin_shares WHERE created_by = ? AND revoked_at IS NULL').get(userId) as { cnt: number }).cnt;

  res.json({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    isAdmin: row.is_admin === 1,
    plan: planLabel(row.plan),
    status: subStatusLabel(row.sub_status),
    activeUntil: row.active_until || null,
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stats: {
      locationCount,
      binCount,
      photoCount,
      photoStorageMb: Math.round((photoStorageBytes / (1024 * 1024)) * 100) / 100,
      apiKeyCount,
      shareCount,
    },
  });
}));

// PUT /api/admin/users/:id — update admin role or subscription status
router.put('/users/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const { isAdmin, subStatus, plan, email, displayName, password, activeUntil } = req.body;

  if (isAdmin === undefined && subStatus === undefined && plan === undefined && email === undefined && displayName === undefined && password === undefined && activeUntil === undefined) {
    throw new ValidationError('Nothing to update');
  }

  const db = getDb();
  const target = db.prepare('SELECT id, username, is_admin, sub_status FROM users WHERE id = ?').get(targetId) as
    { id: string; username: string; is_admin: number; sub_status: number } | undefined;

  if (!target) throw new NotFoundError('User not found');

  // Prevent self-demotion
  if (isAdmin !== undefined && targetId === req.user!.id) {
    throw new ForbiddenError('Cannot change your own admin status');
  }

  // Last-admin protection (single query for both checks)
  if (target.is_admin === 1) {
    const isLastAdmin = getAdminCount() <= 1;
    if (isAdmin === false && isLastAdmin) {
      throw new ForbiddenError('Cannot remove the only admin');
    }
    if (typeof subStatus === 'number' && subStatus === 0 && isLastAdmin) {
      throw new ForbiddenError('Cannot deactivate the only admin');
    }
  }

  if (plan !== undefined && !isSelfHosted()) {
    if (plan !== Plan.LITE && plan !== Plan.PRO) {
      throw new ValidationError('Plan must be 0 (lite) or 1 (pro)');
    }
  }

  if (email !== undefined && email !== '') validateEmail(email);
  if (displayName !== undefined) validateDisplayName(displayName);
  if (password !== undefined) validatePassword(password);

  const updates: string[] = [];
  const updateParams: unknown[] = [];

  if (isAdmin !== undefined) {
    updates.push('is_admin = ?');
    updateParams.push(isAdmin ? 1 : 0);
  }
  if (typeof subStatus === 'number') {
    updates.push('sub_status = ?');
    updateParams.push(subStatus);
  }
  if (plan !== undefined && !isSelfHosted()) {
    updates.push('plan = ?');
    updateParams.push(plan);
  }
  if (email !== undefined) {
    updates.push('email = ?');
    updateParams.push(email === '' ? null : email);
  }
  if (displayName !== undefined) {
    updates.push('display_name = ?');
    updateParams.push(String(displayName).trim());
  }
  if (password !== undefined) {
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    updates.push('password_hash = ?');
    updateParams.push(passwordHash);
  }
  if (activeUntil !== undefined) {
    if (activeUntil !== null && activeUntil !== '') {
      if (typeof activeUntil !== 'string' || Number.isNaN(new Date(activeUntil).getTime())) {
        throw new ValidationError('Invalid date for activeUntil');
      }
      updates.push('active_until = ?');
      updateParams.push(new Date(activeUntil).toISOString());
    } else {
      updates.push('active_until = ?');
      updateParams.push(null);
    }
  }

  if (updates.length === 0) {
    res.json({ message: 'User updated' });
    return;
  }

  updateParams.push(targetId);
  try {
    db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...updateParams);
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ConflictError('Email already in use');
    }
    throw err;
  }

  if (plan !== undefined || typeof subStatus === 'number' || activeUntil !== undefined) {
    invalidatePlanRateLimit(targetId);
    notifyManagerUserUpdate({
      userId: targetId,
      action: 'update_subscription',
      ...(plan !== undefined ? { plan } : {}),
      ...(typeof subStatus === 'number' ? { status: subStatus } : {}),
      ...(activeUntil !== undefined ? { activeUntil: activeUntil || null } : {}),
    });
  }

  const { password: _, ...safeBody } = req.body;
  console.log(`[admin] User ${req.user!.username} updated user ${target.username}: ${JSON.stringify(safeBody)}`);

  res.json({ message: 'User updated' });
}));

// DELETE /api/admin/users/:id — delete a user
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;

  if (targetId === req.user!.id) {
    throw new ForbiddenError('Cannot delete your own account via admin');
  }

  const db = getDb();
  const target = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(targetId) as
    { id: string; username: string; is_admin: number } | undefined;

  if (!target) throw new NotFoundError('User not found');

  // Last-admin protection
  if (target.is_admin === 1 && getAdminCount() <= 1) {
    throw new ForbiddenError('Cannot delete the only admin');
  }

  db.prepare("UPDATE users SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(targetId);
  invalidateDeletedCache(targetId);

  notifyManagerUserUpdate({ userId: targetId, action: 'delete_user' });

  console.log(`[admin] User ${req.user!.username} soft-deleted user ${target.username}`);

  res.json({ message: 'User marked for deletion' });
}));

// POST /api/admin/users/:id/regenerate-api-key — revoke all keys and generate a new one
router.post('/users/:id/regenerate-api-key', asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const db = getDb();

  const target = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetId) as
    { id: string; username: string } | undefined;
  if (!target) throw new NotFoundError('User not found');

  // Revoke all existing keys
  db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").run(targetId);

  // Generate a new key (same pattern as apiKeys.ts)
  const key = `sk_openbin_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.slice(0, 18);
  const id = generateUuid();

  await query(
    'INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name) VALUES ($1, $2, $3, $4, $5)',
    [id, targetId, keyHash, keyPrefix, 'Admin-generated key'],
  );

  console.log(`[admin] User ${req.user!.username} regenerated API key for user ${target.username}`);

  res.json({ keyPrefix, name: 'Admin-generated key', createdAt: new Date().toISOString() });
}));

// POST /api/admin/users/:id/send-password-reset — send password reset email
router.post('/users/:id/send-password-reset', asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const db = getDb();

  const target = db.prepare('SELECT id, username, email, display_name FROM users WHERE id = ?').get(targetId) as
    { id: string; username: string; email: string | null; display_name: string } | undefined;
  if (!target) throw new NotFoundError('User not found');
  if (!target.email) throw new ValidationError('User does not have an email address');

  const { rawToken } = await createPasswordResetToken(targetId, req.user!.id);
  const resetUrl = `${config.baseUrl}/reset-password?token=${rawToken}`;

  firePasswordResetEmail(targetId, target.email, target.display_name, resetUrl);

  console.log(`[admin] User ${req.user!.username} sent password reset for user ${target.username}`);

  res.json({ message: 'Password reset email sent' });
}));

// GET /api/admin/metrics — cloud metrics (cloud mode only)
router.get('/metrics', metricsLimiter, asyncHandler(async (_req, res) => {
  if (config.selfHosted) {
    throw new NotFoundError('Metrics not available in self-hosted mode');
  }

  const metrics = await getCloudMetrics();
  res.json(metrics);
}));

// PATCH /api/admin/registration — toggle registration mode
// Runtime override stored in settings table; env var takes precedence
router.patch('/registration', asyncHandler(async (req, res) => {
  const { mode } = req.body;
  if (!mode || !['open', 'invite', 'closed'].includes(mode)) {
    throw new ValidationError('Invalid registration mode. Must be open, invite, or closed');
  }

  // If REGISTRATION_MODE env var is set, it takes precedence — block runtime changes
  if (process.env.REGISTRATION_MODE) {
    throw new ForbiddenError('Registration mode is locked by REGISTRATION_MODE environment variable');
  }

  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('registration_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(mode);

  console.log(`[admin] User ${req.user!.username} changed registration mode to ${mode}`);

  res.json({ mode });
}));

// GET /api/admin/registration — get current registration mode
router.get('/registration', asyncHandler(async (_req, res) => {
  const mode = getRegistrationMode();
  const locked = !!process.env.REGISTRATION_MODE;
  res.json({ mode, locked });
}));

export function getRegistrationMode(): string {
  // Env var takes precedence
  if (process.env.REGISTRATION_MODE) {
    const mode = process.env.REGISTRATION_MODE;
    if (mode === 'invite' || mode === 'closed') return mode;
    return 'open';
  }
  // Runtime override from settings table
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'registration_mode'").get() as { value: string } | undefined;
  return row?.value || 'open';
}

export { router as adminRoutes };
