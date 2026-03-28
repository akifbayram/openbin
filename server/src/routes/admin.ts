import bcrypt from 'bcrypt';
import { Router } from 'express';
import { generateUuid, getDb, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { getCloudMetrics } from '../lib/metrics.js';
import { isSelfHosted, Plan, type PlanTier, planLabel, SubStatus, type SubStatusType, subStatusLabel } from '../lib/planGate.js';
import { metricsLimiter } from '../lib/rateLimiters.js';
import { validateDisplayName, validateEmail, validatePassword, validateUsername } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';
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
    whereClause = 'WHERE (LOWER(username) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(display_name) LIKE $1)';
    params.push(`%${q.toLowerCase()}%`);
  }

  const countResult = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM users ${whereClause}`,
    params,
  );

  const usersResult = await query(
    `SELECT id, username, display_name, email, is_admin, plan, sub_status, active_until, created_at
     FROM users ${whereClause}
     ORDER BY created_at ASC
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
    createdAt: u.created_at,
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
    'SELECT id, username, display_name, email, is_admin, plan, sub_status, active_until, created_at, updated_at FROM users WHERE id = ?'
  ).get(userId) as {
    id: string; username: string; display_name: string; email: string | null;
    is_admin: number; plan: PlanTier; sub_status: SubStatusType;
    active_until: string | null; created_at: string; updated_at: string;
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
  const { isAdmin, subStatus } = req.body;

  if (isAdmin === undefined && subStatus === undefined) {
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

  updateParams.push(targetId);
  db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...updateParams);

  console.log(`[admin] User ${req.user!.username} updated user ${target.username}: ${JSON.stringify(req.body)}`);

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

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);

  console.log(`[admin] User ${req.user!.username} deleted user ${target.username}`);

  res.json({ message: 'User deleted' });
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
