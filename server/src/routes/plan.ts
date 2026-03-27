import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/httpErrors.js';
import { generateUpgradeUrl, getFeatureMap, getUserPlanInfo, isSelfHosted, Plan, planLabel, subStatusLabel } from '../lib/planGate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  if (isSelfHosted()) {
    res.json({
      plan: 'pro',
      status: 'active',
      activeUntil: null,
      selfHosted: true,
      features: getFeatureMap(Plan.PRO),
      upgradeUrl: null,
    });
    return;
  }

  const planInfo = await getUserPlanInfo(req.user!.id);
  if (!planInfo) throw new NotFoundError('User not found');

  res.json({
    plan: planLabel(planInfo.plan),
    status: subStatusLabel(planInfo.subStatus),
    activeUntil: planInfo.activeUntil,
    selfHosted: false,
    features: getFeatureMap(planInfo.plan),
    upgradeUrl: planInfo.plan === Plan.PRO ? null : generateUpgradeUrl(req.user!.id, planInfo.email),
  });
}));

export { router as planRoutes };
