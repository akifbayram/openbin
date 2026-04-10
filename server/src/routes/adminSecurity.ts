import { Router } from 'express';
import { d, query } from '../db.js';
import { logAdminAction } from '../lib/adminAudit.js';
import { assertUserExists, getAdminCount } from '../lib/adminHelpers.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { authenticate, invalidateUserStatusCache } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// POST /suspend/:id
router.post('/suspend/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const { reason } = req.body;

  if (targetId === req.user!.id) {
    throw new ForbiddenError('Cannot suspend yourself');
  }

  const targetResult = await query<{ id: string; email: string; is_admin: number; suspended_at: string | null }>(
    'SELECT id, email, is_admin, suspended_at FROM users WHERE id = $1',
    [targetId],
  );
  const target = targetResult.rows[0];
  if (!target) throw new NotFoundError('User not found');

  if (target.is_admin && (await getAdminCount()) <= 1) {
    throw new ForbiddenError('Cannot suspend the only admin');
  }

  await query(
    `UPDATE users SET suspended_at = ${d.now()}, token_version = token_version + 1 WHERE id = $1`,
    [targetId],
  );

  invalidateUserStatusCache(targetId);

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'suspend_user',
    targetType: 'user',
    targetId,
    targetName: target.email,
    details: { reason: reason || null },
  });

  res.json({ message: 'User suspended' });
}));

// POST /reactivate/:id
router.post('/reactivate/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;

  const targetResult = await query<{ id: string; email: string; suspended_at: string | null }>(
    'SELECT id, email, suspended_at FROM users WHERE id = $1',
    [targetId],
  );
  const target = targetResult.rows[0];
  if (!target) throw new NotFoundError('User not found');

  if (!target.suspended_at) {
    throw new ValidationError('User is not suspended');
  }

  await query(
    'UPDATE users SET suspended_at = NULL WHERE id = $1',
    [targetId],
  );

  invalidateUserStatusCache(targetId);

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'reactivate_user',
    targetType: 'user',
    targetId,
    targetName: target.email,
  });

  res.json({ message: 'User reactivated' });
}));

// POST /revoke-sessions/:id
router.post('/revoke-sessions/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const target = await assertUserExists(targetId);

  await Promise.all([
    query(
      'UPDATE users SET token_version = token_version + 1 WHERE id = $1',
      [targetId],
    ),
    query(
      `UPDATE refresh_tokens SET revoked_at = ${d.now()} WHERE user_id = $1 AND revoked_at IS NULL`,
      [targetId],
    ),
  ]);

  invalidateUserStatusCache(targetId);

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'revoke_sessions',
    targetType: 'user',
    targetId,
    targetName: target.email,
  });

  res.json({ message: 'All sessions revoked' });
}));

// POST /revoke-all-api-keys/:id
router.post('/revoke-all-api-keys/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const target = await assertUserExists(targetId);

  const result = await query(
    `UPDATE api_keys SET revoked_at = ${d.now()} WHERE user_id = $1 AND revoked_at IS NULL`,
    [targetId],
  );
  const revokedCount = result.rowCount ?? 0;

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'revoke_all_api_keys',
    targetType: 'user',
    targetId,
    targetName: target.email,
    details: { count: revokedCount },
  });

  res.json({ message: 'All API keys revoked', count: revokedCount });
}));

// GET /login-history/:id
router.get('/login-history/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = (page - 1) * limit;

  await assertUserExists(targetId);

  const [countResult, dataResult] = await Promise.all([
    query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM login_history WHERE user_id = $1',
      [targetId],
    ),
    query<{
      id: string;
      ip_address: string | null;
      user_agent: string | null;
      method: string | null;
      success: number;
      created_at: string;
    }>(
      'SELECT id, ip_address, user_agent, method, success, created_at FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [targetId, limit, offset],
    ),
  ]);

  const results = dataResult.rows.map((row) => ({
    id: row.id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    method: row.method,
    success: !!row.success,
    createdAt: row.created_at,
  }));

  res.json({ results, count: countResult.rows[0].cnt });
}));

// POST /force-password-change/:id
router.post('/force-password-change/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const target = await assertUserExists(targetId);
  const enabled = req.body.enabled !== false;

  await query(
    'UPDATE users SET force_password_change = $1 WHERE id = $2',
    [enabled ? 1 : 0, targetId],
  );

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'force_password_change',
    targetType: 'user',
    targetId,
    targetName: target.email,
    details: { enabled },
  });

  res.json({ message: enabled ? 'Password change required on next login' : 'Password change requirement cleared' });
}));

// POST /force-logout-all
router.post('/force-logout-all', asyncHandler(async (req, res) => {
  await Promise.all([
    query('UPDATE users SET token_version = token_version + 1'),
    query(`UPDATE refresh_tokens SET revoked_at = ${d.now()} WHERE revoked_at IS NULL`),
  ]);

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'force_logout_all',
    targetType: 'system',
  });

  res.json({ message: 'All sessions revoked for all users' });
}));

export { router as adminSecurityRoutes };
