import { Router } from 'express';
import { d, generateUuid, query } from '../../db.js';
import { logAdminAction } from '../../lib/adminAudit.js';
import { assertUserExists } from '../../lib/adminHelpers.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { NotFoundError, ValidationError } from '../../lib/httpErrors.js';
import { getFeatureMap, invalidateOverLimitCache, Plan, type PlanTier, planLabel, SubStatus } from '../../lib/planGate.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// ---------------------------------------------------------------------------
// GET /overrides/:userId — current overrides for a user
// ---------------------------------------------------------------------------

router.get('/overrides/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await assertUserExists(userId);

  const result = await query<{
    max_bins: number | null;
    max_locations: number | null;
    max_photo_storage_mb: number | null;
    max_members_per_location: number | null;
    activity_retention_days: number | null;
    ai_credits_per_month: number | null;
    ai_enabled: number | null;
  }>(
    'SELECT max_bins, max_locations, max_photo_storage_mb, max_members_per_location, activity_retention_days, ai_credits_per_month, ai_enabled FROM user_limit_overrides WHERE user_id = $1',
    [userId],
  );

  const row = result.rows[0];
  res.json({
    userId,
    maxBins: row?.max_bins ?? null,
    maxLocations: row?.max_locations ?? null,
    maxPhotoStorageMb: row?.max_photo_storage_mb ?? null,
    maxMembersPerLocation: row?.max_members_per_location ?? null,
    activityRetentionDays: row?.activity_retention_days ?? null,
    aiCreditsPerMonth: row?.ai_credits_per_month ?? null,
    aiEnabled: row ? (row.ai_enabled === null ? null : row.ai_enabled === 1) : null,
  });
}));

// ---------------------------------------------------------------------------
// PUT /overrides/:userId — set / update overrides
// ---------------------------------------------------------------------------

router.put('/overrides/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const target = await assertUserExists(userId);

  const { maxBins, maxLocations, maxPhotoStorageMb, maxMembersPerLocation, activityRetentionDays, aiCreditsPerMonth, aiEnabled } = req.body;

  const id = generateUuid();
  const aiEnabledInt = aiEnabled == null ? null : aiEnabled ? 1 : 0;

  await query(
    `INSERT INTO user_limit_overrides (id, user_id, max_bins, max_locations, max_photo_storage_mb, max_members_per_location, activity_retention_days, ai_credits_per_month, ai_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(user_id) DO UPDATE SET
       max_bins = $3,
       max_locations = $4,
       max_photo_storage_mb = $5,
       max_members_per_location = $6,
       activity_retention_days = $7,
       ai_credits_per_month = $8,
       ai_enabled = $9,
       updated_at = ${d.now()}`,
    [
      id,
      userId,
      maxBins ?? null,
      maxLocations ?? null,
      maxPhotoStorageMb ?? null,
      maxMembersPerLocation ?? null,
      activityRetentionDays ?? null,
      aiCreditsPerMonth ?? null,
      aiEnabledInt,
    ],
  );

  invalidateOverLimitCache(userId);

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'update_overrides',
    targetType: 'user',
    targetId: userId,
    targetName: target.email,
    details: { maxBins, maxLocations, maxPhotoStorageMb, maxMembersPerLocation, activityRetentionDays, aiCreditsPerMonth, aiEnabled },
  });

  res.json({ message: 'Overrides updated' });
}));

// ---------------------------------------------------------------------------
// DELETE /overrides/:userId — clear all overrides
// ---------------------------------------------------------------------------

router.delete('/overrides/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const target = await assertUserExists(userId);

  await query('DELETE FROM user_limit_overrides WHERE user_id = $1', [userId]);

  invalidateOverLimitCache(userId);

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'clear_overrides',
    targetType: 'user',
    targetId: userId,
    targetName: target.email,
  });

  res.json({ message: 'Overrides cleared' });
}));

// ---------------------------------------------------------------------------
// POST /ai-credits/grant/:userId — grant additional AI credits
// ---------------------------------------------------------------------------

router.post('/ai-credits/grant/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const target = await assertUserExists(userId);

  const { amount } = req.body;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > 10000) {
    throw new ValidationError('amount must be a positive integer (max 10000)');
  }

  await query(
    'UPDATE users SET ai_credits_used = CASE WHEN ai_credits_used > $1 THEN ai_credits_used - $1 ELSE 0 END WHERE id = $2',
    [amount, userId],
  );

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'grant_ai_credits',
    targetType: 'user',
    targetId: userId,
    targetName: target.email,
    details: { amount },
  });

  res.json({ message: 'AI credits granted' });
}));

// ---------------------------------------------------------------------------
// POST /ai-credits/reset/:userId — reset AI credits to 0
// ---------------------------------------------------------------------------

router.post('/ai-credits/reset/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const target = await assertUserExists(userId);

  const nextReset = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await query(
    'UPDATE users SET ai_credits_used = 0, ai_credits_reset_at = $1 WHERE id = $2',
    [nextReset, userId],
  );

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'reset_ai_credits',
    targetType: 'user',
    targetId: userId,
    targetName: target.email,
  });

  res.json({ message: 'AI credits reset' });
}));

// ---------------------------------------------------------------------------
// POST /extend-trial/:userId — extend a user's trial period
// ---------------------------------------------------------------------------

router.post('/extend-trial/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const { days } = req.body;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 90) {
    throw new ValidationError('days must be an integer between 1 and 90');
  }

  const userResult = await query<{ id: string; email: string; sub_status: number; active_until: string | null }>(
    'SELECT id, email, sub_status, active_until FROM users WHERE id = $1',
    [userId],
  );
  const target = userResult.rows[0];
  if (!target) throw new NotFoundError('User not found');

  if (target.sub_status !== SubStatus.TRIAL) {
    throw new ValidationError('User is not currently on trial');
  }

  const now = new Date();
  const base = target.active_until && new Date(target.active_until) > now
    ? new Date(target.active_until)
    : now;
  const newActiveUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  await query(
    `UPDATE users SET active_until = $1, updated_at = ${d.now()} WHERE id = $2`,
    [newActiveUntil, userId],
  );

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'extend_trial',
    targetType: 'user',
    targetId: userId,
    targetName: target.email,
    details: { days, newActiveUntil },
  });

  res.json({ message: 'Trial extended', activeUntil: newActiveUntil });
}));

// ---------------------------------------------------------------------------
// POST /grant-comp/:userId — grant a complimentary plan
// ---------------------------------------------------------------------------

router.post('/grant-comp/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const target = await assertUserExists(userId);

  const { plan, days } = req.body;
  if (plan !== Plan.FREE && plan !== Plan.PLUS && plan !== Plan.PRO) {
    throw new ValidationError('plan must be 0 (plus), 1 (pro), or 2 (free)');
  }
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 365) {
    throw new ValidationError('days must be an integer between 1 and 365');
  }

  const activeUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  await query(
    `UPDATE users SET plan = $1, sub_status = $2, active_until = $3, updated_at = ${d.now()} WHERE id = $4`,
    [plan, SubStatus.ACTIVE, activeUntil, userId],
  );

  invalidateOverLimitCache(userId);

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'grant_comp_plan',
    targetType: 'user',
    targetId: userId,
    targetName: target.email,
    details: { plan: planLabel(plan as PlanTier), days, activeUntil },
  });

  res.json({ message: 'Comp plan granted', activeUntil });
}));

// ---------------------------------------------------------------------------
// POST /force-downgrade/:userId — force downgrade with cache invalidation
// ---------------------------------------------------------------------------

router.post('/force-downgrade/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const target = await assertUserExists(userId);

  const { plan } = req.body;
  if (plan !== Plan.FREE && plan !== Plan.PLUS && plan !== Plan.PRO) {
    throw new ValidationError('plan must be 0 (plus), 1 (pro), or 2 (free)');
  }

  const oldResult = await query<{ plan: number }>(
    'SELECT plan FROM users WHERE id = $1',
    [userId],
  );
  const oldPlan = oldResult.rows[0].plan as PlanTier;

  await query(
    `UPDATE users SET plan = $1, updated_at = ${d.now()} WHERE id = $2`,
    [plan, userId],
  );

  invalidateOverLimitCache(userId);

  logAdminAction({
    actorId: req.user!.id,
    actorName: req.user!.email,
    action: 'force_downgrade',
    targetType: 'user',
    targetId: userId,
    targetName: target.email,
    details: { from: planLabel(oldPlan), to: planLabel(plan as PlanTier) },
  });

  res.json({ message: 'Plan downgraded' });
}));

// ---------------------------------------------------------------------------
// GET /ai-usage/:userId — AI usage report
// ---------------------------------------------------------------------------

router.get('/ai-usage/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await assertUserExists(userId);

  const userResult = await query<{
    ai_credits_used: number;
    ai_credits_reset_at: string | null;
    plan: number;
    sub_status: number;
  }>(
    'SELECT ai_credits_used, ai_credits_reset_at, plan, sub_status FROM users WHERE id = $1',
    [userId],
  );
  const user = userResult.rows[0];
  const features = getFeatureMap(user.plan as PlanTier);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const usageResult = await query<{ date: string; call_count: number }>(
    'SELECT date, call_count FROM ai_usage WHERE user_id = $1 AND date >= $2 ORDER BY date DESC',
    [userId, thirtyDaysAgo],
  );

  res.json({
    creditsUsed: user.ai_credits_used ?? 0,
    creditsLimit: features.aiCreditsPerMonth ?? 0,
    resetsAt: user.ai_credits_reset_at ?? null,
    dailyUsage: usageResult.rows.map((r) => ({ date: r.date, calls: r.call_count })),
  });
}));

export { router as adminOverridesRoutes };
