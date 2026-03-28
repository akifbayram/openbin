import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/httpErrors.js';
import { generatePortalUrl, generateUpgradePlanUrl, generateUpgradeUrl, getFeatureMap, getUserPlanInfo, isSelfHosted, isSubscriptionActive, Plan, planLabel, SubStatus, subStatusLabel } from '../lib/planGate.js';
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
    features: getFeatureMap(planInfo.plan),
    upgradeUrl: active && planInfo.plan === Plan.PRO && planInfo.subStatus !== SubStatus.TRIAL ? null : generateUpgradeUrl(userId, email),
    upgradeLiteUrl: isPaidActive ? null : generateUpgradePlanUrl(userId, email, 'lite'),
    upgradeProUrl: isPaidActive ? null : generateUpgradePlanUrl(userId, email, 'pro'),
    portalUrl: isPaidActive ? generatePortalUrl(userId, email) : null,
  });
}));

export { router as planRoutes };
