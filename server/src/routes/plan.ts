import { Router } from 'express';
import { query } from '../db.js';
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

router.get('/usage', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user!.id;

  const [locResult, photoResult, memberResult] = await Promise.all([
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM locations WHERE created_by = $1', [userId]),
    query<{ total: number }>('SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1', [userId]),
    query<{ location_id: string; cnt: number }>(
      `SELECT location_id, COUNT(*) as cnt FROM location_members
       WHERE location_id IN (SELECT id FROM locations WHERE created_by = $1)
       GROUP BY location_id`,
      [userId],
    ),
  ]);

  const memberCounts: Record<string, number> = {};
  for (const row of memberResult.rows) {
    memberCounts[row.location_id] = row.cnt;
  }

  res.json({
    locationCount: locResult.rows[0].cnt,
    photoStorageMb: Math.round((photoResult.rows[0].total / (1024 * 1024)) * 100) / 100,
    memberCounts,
  });
}));

export { router as planRoutes };
