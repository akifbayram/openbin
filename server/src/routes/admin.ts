import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import multer from 'multer';
import { d, generateUuid, isUniqueViolation, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { runBackup } from '../lib/backup.js';
import { config } from '../lib/config.js';
import { firePasswordResetEmail } from '../lib/emailSender.js';
import { ConflictError, ForbiddenError, HttpError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { createLogger } from '../lib/logger.js';
import { notifyManagerUserUpdate } from '../lib/managerWebhook.js';
import { getCloudMetrics, getPlanBreakdown } from '../lib/metrics.js';
import { createPasswordResetToken } from '../lib/passwordReset.js';
import { getFeatureMap, invalidateOverLimitCache, isSelfHosted, Plan, type PlanTier, planLabel, SubStatus, type SubStatusType, subStatusLabel, validatePlanTransition } from '../lib/planGate.js';
import { metricsLimiter } from '../lib/rateLimiters.js';
import { restoreBackup } from '../lib/restore.js';
import { validateDisplayName, validateEmail, validatePassword, validateUsername } from '../lib/validation.js';
import { authenticate, invalidateDeletedCache } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const log = createLogger('admin');
const router = Router();

async function getAdminCount(): Promise<number> {
  const result = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users WHERE is_admin = TRUE');
  return result.rows[0].cnt;
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
    lastActive: 'u.last_active_at',
    items: 'item_count',
    photos: 'photo_count',
    scans30d: 'scans_30d',
    aiCredits: 'u.ai_credits_used',
    apiKeys: 'api_key_count',
    apiRequests7d: 'api_requests_7d',
    binPct: 'bin_count',
    storagePct: 'photo_storage_bytes',
    binsCreated7d: 'bins_created_7d',
    accountAge: 'u.created_at',
  };
  const orderCol = Object.hasOwn(sortMap, field) ? sortMap[field] : sortMap.created;
  const orderDir = desc ? 'DESC' : 'ASC';

  const usersResult = await query(
    `SELECT u.id, u.username, u.display_name, u.email, u.is_admin, u.plan, u.sub_status,
       u.active_until, u.deleted_at, u.created_at, u.last_active_at,
       u.ai_credits_used, u.ai_credits_reset_at,
       (SELECT COUNT(*) FROM bins b JOIN location_members lm ON b.location_id = lm.location_id WHERE lm.user_id = u.id AND b.deleted_at IS NULL) AS bin_count,
       (SELECT COUNT(DISTINCT lm.location_id) FROM location_members lm WHERE lm.user_id = u.id) AS location_count,
       (SELECT COALESCE(SUM(p.size), 0) FROM photos p WHERE p.created_by = u.id) AS photo_storage_bytes,
       (SELECT COUNT(*) FROM bin_items bi JOIN bins b ON b.id = bi.bin_id WHERE b.created_by = u.id AND b.deleted_at IS NULL) AS item_count,
       (SELECT COUNT(*) FROM photos WHERE created_by = u.id) AS photo_count,
       (SELECT COUNT(*) FROM scan_history WHERE user_id = u.id AND scanned_at >= ${d.daysAgo(30)}) AS scans_30d,
       (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id AND revoked_at IS NULL) AS api_key_count,
       (SELECT COALESCE(SUM(request_count), 0) FROM api_key_daily_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = u.id) AND date >= ${d.dateOf(d.daysAgo(7))}) AS api_requests_7d,
       (SELECT COUNT(*) FROM bins WHERE created_by = u.id AND deleted_at IS NULL AND created_at >= ${d.daysAgo(7)}) AS bins_created_7d
     FROM users u ${whereClause}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  const results = usersResult.rows.map((u: any) => {
    const features = getFeatureMap(u.plan as PlanTier);
    return {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      email: u.email || null,
      isAdmin: !!u.is_admin,
      plan: planLabel(u.plan),
      status: subStatusLabel(u.sub_status),
      activeUntil: u.active_until || null,
      deletedAt: u.deleted_at || null,
      createdAt: u.created_at,
      binCount: u.bin_count ?? 0,
      locationCount: u.location_count ?? 0,
      photoStorageMb: Math.round((u.photo_storage_bytes ?? 0) / 1024 / 1024 * 10) / 10,
      lastActiveAt: u.last_active_at || null,
      itemCount: u.item_count ?? 0,
      photoCount: u.photo_count ?? 0,
      scans30d: u.scans_30d ?? 0,
      aiCreditsUsed: u.ai_credits_used ?? 0,
      aiCreditsLimit: features.aiCreditsPerMonth ?? 0,
      apiKeyCount: u.api_key_count ?? 0,
      apiRequests7d: u.api_requests_7d ?? 0,
      binsCreated7d: u.bins_created_7d ?? 0,
      binLimit: features.maxBins,
      storageLimit: features.maxPhotoStorageMb,
    };
  });

  res.json({ results, count: countResult.rows[0].cnt, adminCount: await getAdminCount() });
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
       VALUES ($1, $2, $3, $4, $5, ${isAdmin ? 'TRUE' : 'FALSE'}, $6, $7, $8)
       RETURNING id, username, display_name, email, is_admin, plan, sub_status, created_at`,
      [
        userId,
        username.toLowerCase(),
        passwordHash,
        displayName || username,
        email || null,
        Plan.PLUS,
        isSelfHosted() ? SubStatus.ACTIVE : SubStatus.TRIAL,
        isSelfHosted()
          ? new Date(Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + config.trialPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
      ]
    );
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('Username already taken');
    }
    throw err;
  }

  const user = result.rows[0] as {
    id: string; username: string; display_name: string; email: string | null;
    is_admin: number; plan: PlanTier; sub_status: SubStatusType; created_at: string;
  };

  log.info(`User ${req.user!.username} created user ${username}`);

  res.status(201).json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    isAdmin: !!user.is_admin,
    plan: planLabel(user.plan),
    status: subStatusLabel(user.sub_status),
    createdAt: user.created_at,
  });
}));

// GET /api/admin/users/:id — user detail with stats
router.get('/users/:id', asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const userResult = await query<{
    id: string; username: string; display_name: string; email: string | null;
    is_admin: number; plan: PlanTier; sub_status: SubStatusType;
    active_until: string | null; deleted_at: string | null; created_at: string; updated_at: string;
    last_active_at: string | null; ai_credits_used: number | null; ai_credits_reset_at: string | null;
  }>(
    'SELECT id, username, display_name, email, is_admin, plan, sub_status, active_until, deleted_at, created_at, updated_at, last_active_at, ai_credits_used, ai_credits_reset_at FROM users WHERE id = $1',
    [userId],
  );

  const row = userResult.rows[0];
  if (!row) throw new NotFoundError('User not found');

  const [locationRes, binRes, photoRes, storageRes, apiKeyRes, shareRes, itemRes, scanRes, apiReqRes, binsCreated7dRes] = await Promise.all([
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM locations WHERE created_by = $1', [userId]),
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM bins WHERE created_by = $1 AND deleted_at IS NULL', [userId]),
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM photos WHERE created_by = $1', [userId]),
    query<{ total: number }>('SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1', [userId]),
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL', [userId]),
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM bin_shares WHERE created_by = $1 AND revoked_at IS NULL', [userId]),
    query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM bin_items bi JOIN bins b ON b.id = bi.bin_id WHERE b.created_by = $1 AND b.deleted_at IS NULL`, [userId]),
    query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM scan_history WHERE user_id = $1 AND scanned_at >= ${d.daysAgo(30)}`, [userId]),
    query<{ total: number }>(`SELECT COALESCE(SUM(request_count), 0) as total FROM api_key_daily_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = $1) AND date >= ${d.dateOf(d.daysAgo(7))}`, [userId]),
    query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM bins WHERE created_by = $1 AND deleted_at IS NULL AND created_at >= ${d.daysAgo(7)}`, [userId]),
  ]);

  const features = getFeatureMap(row.plan);

  res.json({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    isAdmin: !!row.is_admin,
    plan: planLabel(row.plan),
    status: subStatusLabel(row.sub_status),
    activeUntil: row.active_until || null,
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at || null,
    stats: {
      locationCount: locationRes.rows[0].cnt,
      binCount: binRes.rows[0].cnt,
      photoCount: photoRes.rows[0].cnt,
      photoStorageMb: Math.round((storageRes.rows[0].total / (1024 * 1024)) * 100) / 100,
      apiKeyCount: apiKeyRes.rows[0].cnt,
      shareCount: shareRes.rows[0].cnt,
      itemCount: itemRes.rows[0].cnt,
      scans30d: scanRes.rows[0].cnt,
      aiCreditsUsed: row.ai_credits_used ?? 0,
      aiCreditsLimit: features.aiCreditsPerMonth ?? 0,
      aiCreditsResetAt: row.ai_credits_reset_at || null,
      apiRequests7d: apiReqRes.rows[0].total,
      binsCreated7d: binsCreated7dRes.rows[0].cnt,
      binLimit: features.maxBins,
      storageLimit: features.maxPhotoStorageMb,
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

  const targetResult = await query<{ id: string; username: string; is_admin: number; sub_status: number; plan: number }>(
    'SELECT id, username, is_admin, sub_status, plan FROM users WHERE id = $1',
    [targetId],
  );
  const target = targetResult.rows[0];

  if (!target) throw new NotFoundError('User not found');

  // Prevent self-demotion
  if (isAdmin !== undefined && targetId === req.user!.id) {
    throw new ForbiddenError('Cannot change your own admin status');
  }

  // Last-admin protection (single query for both checks)
  if (target.is_admin) {
    const isLastAdmin = (await getAdminCount()) <= 1;
    if (isAdmin === false && isLastAdmin) {
      throw new ForbiddenError('Cannot remove the only admin');
    }
    if (typeof subStatus === 'number' && subStatus === 0 && isLastAdmin) {
      throw new ForbiddenError('Cannot deactivate the only admin');
    }
  }

  if (plan !== undefined && !isSelfHosted()) {
    if (plan !== Plan.FREE && plan !== Plan.PLUS && plan !== Plan.PRO) {
      throw new ValidationError('Plan must be 0 (plus), 1 (pro), or 2 (free)');
    }
  }

  // Cross-validate plan + status combination
  if (!isSelfHosted()) {
    const effectivePlan = plan !== undefined ? plan : target.plan;
    const effectiveStatus = typeof subStatus === 'number' ? subStatus : target.sub_status;
    if (!validatePlanTransition(effectivePlan as PlanTier, effectiveStatus as SubStatusType)) {
      throw new ValidationError('Invalid plan/status combination: TRIAL is only valid for PLUS');
    }
  }

  if (email !== undefined && email !== '') validateEmail(email);
  if (displayName !== undefined) validateDisplayName(displayName);
  if (password !== undefined) validatePassword(password);

  const updates: string[] = [];
  const updateParams: unknown[] = [];
  let paramIdx = 0;
  const nextParam = () => `$${++paramIdx}`;

  if (isAdmin !== undefined) {
    updates.push(`is_admin = ${nextParam()}`);
    updateParams.push(isAdmin ? 1 : 0);
  }
  if (typeof subStatus === 'number') {
    updates.push(`sub_status = ${nextParam()}`);
    updateParams.push(subStatus);
  }
  if (plan !== undefined && !isSelfHosted()) {
    updates.push(`plan = ${nextParam()}`);
    updateParams.push(plan);
  }
  if (email !== undefined) {
    updates.push(`email = ${nextParam()}`);
    updateParams.push(email === '' ? null : email);
  }
  if (displayName !== undefined) {
    updates.push(`display_name = ${nextParam()}`);
    updateParams.push(String(displayName).trim());
  }
  if (password !== undefined) {
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    updates.push(`password_hash = ${nextParam()}`);
    updateParams.push(passwordHash);
  }
  if (activeUntil !== undefined) {
    if (activeUntil !== null && activeUntil !== '') {
      if (typeof activeUntil !== 'string' || Number.isNaN(new Date(activeUntil).getTime())) {
        throw new ValidationError('Invalid date for activeUntil');
      }
      updates.push(`active_until = ${nextParam()}`);
      updateParams.push(new Date(activeUntil).toISOString());
    } else {
      updates.push(`active_until = ${nextParam()}`);
      updateParams.push(null);
    }
  }

  if (updates.length === 0) {
    res.json({ message: 'User updated' });
    return;
  }

  const whereParam = nextParam();
  updateParams.push(targetId);
  try {
    await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = ${d.now()} WHERE id = ${whereParam}`,
      updateParams,
    );
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('Email already in use');
    }
    throw err;
  }

  if (plan !== undefined || typeof subStatus === 'number' || activeUntil !== undefined) {
    notifyManagerUserUpdate({
      userId: targetId,
      action: 'update_subscription',
      ...(plan !== undefined ? { plan } : {}),
      ...(typeof subStatus === 'number' ? { status: subStatus } : {}),
      ...(activeUntil !== undefined ? { activeUntil: activeUntil || null } : {}),
    });
    invalidateOverLimitCache(targetId);
  }

  // Fire lifecycle emails on plan/status changes
  if (!isSelfHosted() && (plan !== undefined || typeof subStatus === 'number')) {
    const updatedUserResult = await query<{ email: string | null; display_name: string; active_until: string | null }>(
      'SELECT email, display_name, active_until FROM users WHERE id = $1',
      [targetId],
    );
    const updatedUser = updatedUserResult.rows[0];

    if (updatedUser?.email) {
      const effectiveStatus = typeof subStatus === 'number' ? subStatus : target.sub_status;
      const effectivePlan = plan !== undefined ? plan : target.plan;

      if (effectiveStatus === SubStatus.ACTIVE) {
        const { fireSubscriptionConfirmedEmail } = await import('../lib/emailSender.js');
        fireSubscriptionConfirmedEmail(targetId, updatedUser.email, updatedUser.display_name, effectivePlan as PlanTier, updatedUser.active_until);
      } else if (effectiveStatus === SubStatus.INACTIVE) {
        const { fireSubscriptionExpiredEmail } = await import('../lib/emailSender.js');
        fireSubscriptionExpiredEmail(targetId, updatedUser.email, updatedUser.display_name);
      }
    }
  }

  const { password: _, ...safeBody } = req.body;
  log.info(`User ${req.user!.username} updated user ${target.username}: ${JSON.stringify(safeBody)}`);

  res.json({ message: 'User updated' });
}));

// DELETE /api/admin/users/:id — delete a user
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const targetId = req.params.id;

  if (targetId === req.user!.id) {
    throw new ForbiddenError('Cannot delete your own account via admin');
  }

  const targetResult = await query<{ id: string; username: string; is_admin: number }>(
    'SELECT id, username, is_admin FROM users WHERE id = $1',
    [targetId],
  );
  const target = targetResult.rows[0];

  if (!target) throw new NotFoundError('User not found');

  // Last-admin protection
  if (target.is_admin && (await getAdminCount()) <= 1) {
    throw new ForbiddenError('Cannot delete the only admin');
  }

  await query(
    `UPDATE users SET deleted_at = ${d.now()}, updated_at = ${d.now()} WHERE id = $1`,
    [targetId],
  );
  invalidateDeletedCache(targetId);

  notifyManagerUserUpdate({ userId: targetId, action: 'delete_user' });

  log.info(`User ${req.user!.username} soft-deleted user ${target.username}`);

  res.json({ message: 'User marked for deletion' });
}));

// POST /api/admin/users/:id/regenerate-api-key — revoke all keys and generate a new one
router.post('/users/:id/regenerate-api-key', asyncHandler(async (req, res) => {
  const targetId = req.params.id;

  const targetResult = await query<{ id: string; username: string }>(
    'SELECT id, username FROM users WHERE id = $1',
    [targetId],
  );
  const target = targetResult.rows[0];
  if (!target) throw new NotFoundError('User not found');

  // Revoke all existing keys
  await query(
    `UPDATE api_keys SET revoked_at = ${d.now()} WHERE user_id = $1 AND revoked_at IS NULL`,
    [targetId],
  );

  // Generate a new key (same pattern as apiKeys.ts)
  const key = `sk_openbin_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.slice(0, 18);
  const id = generateUuid();

  await query(
    'INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name) VALUES ($1, $2, $3, $4, $5)',
    [id, targetId, keyHash, keyPrefix, 'Admin-generated key'],
  );

  log.info(`User ${req.user!.username} regenerated API key for user ${target.username}`);

  res.json({ keyPrefix, name: 'Admin-generated key', createdAt: new Date().toISOString() });
}));

// POST /api/admin/users/:id/send-password-reset — send password reset email
router.post('/users/:id/send-password-reset', asyncHandler(async (req, res) => {
  const targetId = req.params.id;

  const targetResult = await query<{ id: string; username: string; email: string | null; display_name: string }>(
    'SELECT id, username, email, display_name FROM users WHERE id = $1',
    [targetId],
  );
  const target = targetResult.rows[0];
  if (!target) throw new NotFoundError('User not found');
  if (!target.email) throw new ValidationError('User does not have an email address');

  const { rawToken } = await createPasswordResetToken(targetId, req.user!.id);
  const resetUrl = `${config.baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

  firePasswordResetEmail(targetId, target.email, target.display_name, resetUrl);

  log.info(`User ${req.user!.username} sent password reset for user ${target.username}`);

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

// GET /api/admin/metrics/plan-breakdown — per-plan usage averages
router.get('/metrics/plan-breakdown', metricsLimiter, asyncHandler(async (_req, res) => {
  if (config.selfHosted) {
    throw new NotFoundError('Metrics not available in self-hosted mode');
  }
  const breakdown = await getPlanBreakdown();
  res.json(breakdown);
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

  await query(
    "INSERT INTO settings (key, value) VALUES ('registration_mode', $1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [mode],
  );

  log.info(`User ${req.user!.username} changed registration mode to ${mode}`);

  res.json({ mode });
}));

// GET /api/admin/registration — get current registration mode
router.get('/registration', asyncHandler(async (_req, res) => {
  const mode = await getRegistrationMode();
  const locked = !!process.env.REGISTRATION_MODE;
  res.json({ mode, locked });
}));

export async function getRegistrationMode(): Promise<string> {
  // Env var takes precedence
  if (process.env.REGISTRATION_MODE) {
    const mode = process.env.REGISTRATION_MODE;
    if (mode === 'invite' || mode === 'closed') return mode;
    return 'open';
  }
  // Runtime override from settings table
  const result = await query<{ value: string }>("SELECT value FROM settings WHERE key = 'registration_mode'");
  return result.rows[0]?.value || 'open';
}

// POST /api/admin/backup — trigger on-demand backup
router.post('/backup', asyncHandler(async (req, res) => {
  const zipPath = await runBackup();
  log.info(`On-demand backup created by ${req.user!.username}`);
  res.json({ message: 'Backup created', filename: path.basename(zipPath) });
}));

// POST /api/admin/restore — restore from backup ZIP
const restoreUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(config.backupPath, { recursive: true });
      cb(null, config.backupPath);
    },
    filename: (_req, _file, cb) => cb(null, `.restore-upload-${Date.now()}.zip`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
}).single('file');

router.post('/restore', restoreUpload, asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('ZIP file is required');
  }

  const result = await restoreBackup(req.file.path);

  // Clean up the uploaded file
  try { fs.unlinkSync(req.file.path); } catch { /* best effort */ }

  if (!result.success) {
    throw new HttpError(500, 'RESTORE_FAILED', result.error || 'Unknown restore error');
  }

  log.info(`Backup restored by ${req.user!.username}`);
  res.json({ message: 'Backup restored successfully' });
}));

export { router as adminRoutes };
