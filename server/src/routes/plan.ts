import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { generateUpgradeUrl, getFeatureMap, getUserPlanInfo, isSelfHosted, Plan } from '../lib/planGate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/plan
router.get('/', authenticate, asyncHandler(async (req, res) => {
  if (isSelfHosted()) {
    // Self-hosted: return full pro features, no upgrade needed
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
  if (!planInfo) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  const planLabel = planInfo.plan === Plan.PRO ? 'pro' : 'lite';
  const statusLabel = planInfo.subStatus === 2 ? 'trial' : planInfo.subStatus === 1 ? 'active' : 'inactive';

  res.json({
    plan: planLabel,
    status: statusLabel,
    activeUntil: planInfo.activeUntil,
    selfHosted: false,
    features: getFeatureMap(planInfo.plan),
    upgradeUrl: planInfo.plan === Plan.PRO ? null : generateUpgradeUrl(req.user!.id, planInfo.email),
  });
}));

export { router as planRoutes };
