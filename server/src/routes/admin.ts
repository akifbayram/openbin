import { Router } from 'express';
import { getDb, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { getCloudMetrics } from '../lib/metrics.js';
import { planLabel, subStatusLabel } from '../lib/planGate.js';
import { metricsLimiter } from '../lib/rateLimiters.js';
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
