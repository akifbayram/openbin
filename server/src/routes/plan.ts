import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/httpErrors.js';
import { computeOverLimits, generatePortalUrl, generateUpgradePlanUrl, generateUpgradeUrl, getFeatureMap, getUserPlanInfo, getUserUsage, isSelfHosted, isSubscriptionActive, Plan, planLabel, SubStatus, subStatusLabel } from '../lib/planGate.js';
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
      upgradeLiteUrl: null,
      upgradeProUrl: null,
      portalUrl: null,
    });
    return;
  }

  const planInfo = await getUserPlanInfo(req.user!.id);
  if (!planInfo) throw new NotFoundError('User not found');

  const active = isSubscriptionActive(planInfo);
  const isPaidActive = active && planInfo.subStatus === SubStatus.ACTIVE;
  const userId = req.user!.id;
  const { email } = planInfo;

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
    upgradeUrl: active && planInfo.plan === Plan.PRO && planInfo.subStatus !== SubStatus.TRIAL ? null : generateUpgradeUrl(userId, email),
    upgradeLiteUrl: isPaidActive ? null : generateUpgradePlanUrl(userId, email, 'lite'),
    upgradeProUrl: isPaidActive ? null : generateUpgradePlanUrl(userId, email, 'pro'),
    portalUrl: isPaidActive ? generatePortalUrl(userId, email) : null,
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

export { router as planRoutes };
