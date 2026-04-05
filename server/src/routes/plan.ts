import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/httpErrors.js';
import { computeOverLimits, generatePortalUrl, generateUpgradePlanUrl, generateUpgradeUrl, getAiCredits, getFeatureMap, getUserPlanInfo, getUserUsage, isSelfHosted, isSubscriptionActive, Plan, planLabel, SubStatus, subStatusLabel } from '../lib/planGate.js';
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

  const aiCreditsRaw = await getAiCredits(userId);
  const aiCredits = aiCreditsRaw.limit > 0
    ? { used: aiCreditsRaw.used, limit: aiCreditsRaw.limit, resetsAt: aiCreditsRaw.resetsAt }
    : null;

  res.json({
    plan: planLabel(planInfo.plan),
    status: subStatusLabel(planInfo.subStatus),
    activeUntil: planInfo.activeUntil,
    selfHosted: false,
    locked: !active,
    previousSubStatus: planInfo.previousSubStatus !== null
      ? (planInfo.previousSubStatus === SubStatus.TRIAL ? 'trial' : 'active')
      : null,
    features: getFeatureMap(planInfo.plan),
    upgradeUrl: active && planInfo.plan === Plan.PRO ? null : await generateUpgradeUrl(userId, email),
    upgradePlusUrl: isPaidActive ? null : await generateUpgradePlanUrl(userId, email, 'plus'),
    upgradeProUrl: isPaidActive ? null : await generateUpgradePlanUrl(userId, email, 'pro'),
    portalUrl: isPaidActive ? await generatePortalUrl(userId, email) : null,
    aiCredits,
  });
}));

router.get('/usage', authenticate, asyncHandler(async (req, res) => {
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

export { router as planRoutes };
