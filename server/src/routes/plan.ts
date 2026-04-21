import { Router } from 'express';
import { d, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { computeOverLimits, generatePortalUrl, generateUpgradePlanUrl, generateUpgradeUrl, getAiCredits, getFeatureMap, getUserPlanInfo, getUserUsage, invalidateOverLimitCache, isSelfHosted, isSubscriptionActive, Plan, planLabel, SELF_HOSTED_USAGE_STUB, SELF_HOSTED_USAGE_SUMMARY_STUB, SubStatus, subStatusLabel } from '../lib/planGate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  if (isSelfHosted()) {
    res.json({
      plan: 'pro',
      status: 'active',
      activeUntil: null,
      selfHosted: true,
      locked: false,
      features: getFeatureMap(Plan.PRO),
      upgradeUrl: null,
      upgradePlusUrl: null,
      upgradeProUrl: null,
      subscribePlanUrl: null,
      portalUrl: null,
      aiCredits: null,
    });
    return;
  }

  const planInfo = await getUserPlanInfo(req.user!.id);
  if (!planInfo) throw new NotFoundError('User not found');

  const active = isSubscriptionActive(planInfo);
  const isPaidActive = active && planInfo.subStatus === SubStatus.ACTIVE;
  const userId = req.user!.id;
  const { email } = planInfo;
  const { plan, subStatus } = planInfo;

  const isFree = plan === Plan.FREE;
  const isPlus = plan === Plan.PLUS;
  const isPro = plan === Plan.PRO;
  const isTrial = subStatus === SubStatus.TRIAL;
  const isLapsed = !isPaidActive && !isTrial;

  const aiCreditsRaw = await getAiCredits(userId);
  const aiCredits = aiCreditsRaw.limit > 0
    ? { used: aiCreditsRaw.used, limit: aiCreditsRaw.limit, resetsAt: aiCreditsRaw.resetsAt }
    : null;

  res.json({
    plan: planLabel(plan),
    status: subStatusLabel(subStatus),
    activeUntil: planInfo.activeUntil,
    selfHosted: false,
    locked: !active,
    previousSubStatus: planInfo.previousSubStatus !== null
      ? (planInfo.previousSubStatus === SubStatus.TRIAL ? 'trial' : 'active')
      : null,
    features: getFeatureMap(plan),
    upgradeUrl: active && isPro ? null : await generateUpgradeUrl(userId, email, planInfo.previousSubStatus !== null),
    upgradePlusUrl: isFree || (isPlus && isLapsed)
      ? await generateUpgradePlanUrl(userId, email, 'plus') : null,
    upgradeProUrl: !isPro || !isPaidActive
      ? await generateUpgradePlanUrl(userId, email, 'pro') : null,
    subscribePlanUrl: isTrial || (!isFree && isLapsed)
      ? await generateUpgradePlanUrl(userId, email, planLabel(plan) as 'plus' | 'pro') : null,
    portalUrl: isPaidActive ? await generatePortalUrl(userId, email) : null,
    canDowngradeToFree: !isFree && !isPaidActive,
    aiCredits,
  });
}));

router.get('/usage', authenticate, asyncHandler(async (req, res) => {
  if (isSelfHosted()) {
    // No plan limits exist on self-hosted — return an empty usage snapshot with no over-limits.
    // Defense in depth: the client short-circuits this endpoint too, but direct API consumers
    // (older clients, API keys) may still call it.
    res.json(SELF_HOSTED_USAGE_STUB);
    return;
  }

  const userId = req.user!.id;
  const usage = await getUserUsage(userId);
  const planInfo = await getUserPlanInfo(userId);
  const features = planInfo ? getFeatureMap(planInfo.plan) : getFeatureMap(Plan.PRO);

  res.json({
    ...usage,
    overLimits: computeOverLimits(usage, features),
  });
}));

router.get('/usage-summary', authenticate, asyncHandler(async (req, res) => {
  if (isSelfHosted()) {
    // Self-hosted has no plan limits or AI credit quotas to report.
    res.json(SELF_HOSTED_USAGE_SUMMARY_STUB);
    return;
  }

  const userId = req.user!.id;
  const [usage, aiCredits, fieldCount] = await Promise.all([
    getUserUsage(userId),
    getAiCredits(userId),
    query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM location_custom_fields WHERE location_id IN (SELECT id FROM locations WHERE created_by = $1)',
      [userId],
    ),
  ]);

  res.json({
    binCount: usage.binCount,
    photoCount: usage.photoCount,
    photoStorageMb: usage.photoStorageMb,
    customFieldCount: fieldCount.rows[0].cnt,
    aiCreditsUsed: aiCredits.used,
    aiCreditsLimit: aiCredits.limit,
    aiCreditsResetsAt: aiCredits.resetsAt,
  });
}));

router.post('/downgrade-to-free', authenticate, asyncHandler(async (req, res) => {
  if (isSelfHosted()) {
    throw new NotFoundError('Not available in self-hosted mode');
  }

  const userId = req.user!.id;
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) throw new NotFoundError('User not found');

  if (planInfo.plan === Plan.FREE) {
    throw new ValidationError('Already on the Free plan');
  }

  // Block if user has an active paid subscription (must cancel in Stripe first)
  // Check both subStatus AND activeUntil — a user with ACTIVE status but expired
  // activeUntil is effectively locked and should be allowed to downgrade.
  if (isSubscriptionActive(planInfo) && planInfo.subStatus === SubStatus.ACTIVE) {
    throw new ValidationError('Cancel your paid subscription before downgrading to Free');
  }

  await query(
    `UPDATE users SET plan = $1, sub_status = $2, active_until = NULL, previous_sub_status = NULL, updated_at = ${d.now()} WHERE id = $3`,
    [Plan.FREE, SubStatus.ACTIVE, userId],
  );

  invalidateOverLimitCache(userId);

  res.json({ ok: true });
}));

export { router as planRoutes };
