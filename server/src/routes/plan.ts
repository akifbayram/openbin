import { Router } from 'express';
import { d, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { postBillingDowngrade } from '../lib/billingClient.js';
import { computeDowngradeImpact } from '../lib/downgradeImpact.js';
import { NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { type CheckoutAction, computeOverLimits, generatePortalAction, generateUpgradeAction, generateUpgradePlanAction, getAiCredits, getFeatureMap, getUserPlanInfo, getUserUsage, invalidateOverLimitCache, isSelfHosted, isSubscriptionActive, Plan, planLabel, renderActionAsUrl, SELF_HOSTED_USAGE_STUB, SELF_HOSTED_USAGE_SUMMARY_STUB, SubStatus, subStatusLabel } from '../lib/planGate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Helper: render an action's URL form for the *Url back-compat field, or
// return null if the action itself is null. Lets the response object stay
// readable below without ?: chains around every URL field.
function actionToUrl(action: CheckoutAction | null): string | null {
  return action ? renderActionAsUrl(action) : null;
}

const VALID_TARGETS = new Set(['free', 'plus']);

function planLabelToTier(label: 'free' | 'plus' | 'pro') {
  if (label === 'free') return Plan.FREE;
  if (label === 'plus') return Plan.PLUS;
  return Plan.PRO;
}

function rankPlan(label: 'free' | 'plus' | 'pro'): number {
  return label === 'free' ? 0 : label === 'plus' ? 1 : 2;
}

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
      // CheckoutAction-shaped fields (see lib/planGate.ts). New consumers
      // should use *Action over *Url so tokens never land in URLs / browser
      // history / Referer for endpoints we control (POST-able).
      upgradeAction: null,
      upgradePlusAction: null,
      upgradeProAction: null,
      subscribePlanAction: null,
      portalAction: null,
      aiCredits: null,
      cancelAtPeriodEnd: null,
      billingPeriod: null,
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

  // Generate every *Action once so we can derive matching *Url fields
  // without firing the JWT-sign code path twice for the same surface.
  const [upgradeAction, upgradePlusAction, upgradeProAction, subscribePlanAction, portalAction] = await Promise.all([
    active && isPro ? null : generateUpgradeAction(userId, email, planInfo.previousSubStatus !== null),
    isFree || (isPlus && isLapsed) ? generateUpgradePlanAction(userId, email, 'plus') : null,
    !isPro || !isPaidActive ? generateUpgradePlanAction(userId, email, 'pro') : null,
    isTrial || (!isFree && isLapsed) ? generateUpgradePlanAction(userId, email, planLabel(plan) as 'plus' | 'pro') : null,
    isPaidActive ? generatePortalAction(userId, email) : null,
  ]);

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
    // Legacy URL fields. Kept populated for back-compat with older clients
    // and for email templates that need a plain href. New client code MUST
    // prefer the matching *Action field (token in form body, not URL).
    upgradeUrl: actionToUrl(upgradeAction),
    upgradePlusUrl: actionToUrl(upgradePlusAction),
    upgradeProUrl: actionToUrl(upgradeProAction),
    subscribePlanUrl: actionToUrl(subscribePlanAction),
    portalUrl: actionToUrl(portalAction),
    // Preferred shape for new consumers.
    upgradeAction,
    upgradePlusAction,
    upgradeProAction,
    subscribePlanAction,
    portalAction,
    canDowngradeToFree: !isFree && !isPaidActive,
    aiCredits,
    cancelAtPeriodEnd: planInfo.cancelAtPeriodEnd,
    billingPeriod: planInfo.billingPeriod,
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

router.post('/downgrade-impact', authenticate, asyncHandler(async (req, res) => {
  if (isSelfHosted()) throw new NotFoundError('Not available in self-hosted mode');

  const { targetPlan } = req.body as { targetPlan?: unknown };
  if (typeof targetPlan !== 'string' || !VALID_TARGETS.has(targetPlan)) {
    throw new ValidationError('targetPlan must be "free" or "plus"');
  }

  const userId = req.user!.id;
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) throw new NotFoundError('User not found');

  const currentLabel = planLabel(planInfo.plan) as 'free' | 'plus' | 'pro';
  if (rankPlan(targetPlan as 'free' | 'plus') >= rankPlan(currentLabel)) {
    throw new ValidationError('Target plan must be a downgrade');
  }

  const usage = await getUserUsage(userId);
  const impact = computeDowngradeImpact({
    currentFeatures: getFeatureMap(planInfo.plan),
    targetFeatures: getFeatureMap(planLabelToTier(targetPlan as 'free' | 'plus')),
    targetPlan: targetPlan as 'free' | 'plus',
    usage,
  });

  res.json(impact);
}));

router.post('/downgrade', authenticate, asyncHandler(async (req, res) => {
  if (isSelfHosted()) throw new NotFoundError('Not available in self-hosted mode');

  const { targetPlan } = req.body as { targetPlan?: unknown };
  if (typeof targetPlan !== 'string' || !VALID_TARGETS.has(targetPlan)) {
    throw new ValidationError('targetPlan must be "free" or "plus"');
  }

  const userId = req.user!.id;
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) throw new NotFoundError('User not found');

  const currentLabel = planLabel(planInfo.plan) as 'free' | 'plus' | 'pro';
  if (rankPlan(targetPlan as 'free' | 'plus') >= rankPlan(currentLabel)) {
    throw new ValidationError('Target plan must be a downgrade');
  }

  const isActivePaid = isSubscriptionActive(planInfo) && planInfo.subStatus === SubStatus.ACTIVE;

  if (!isActivePaid && targetPlan === 'free') {
    // Lapsed -> free: direct DB mutation (existing pattern from /downgrade-to-free)
    await query(
      `UPDATE users SET plan = $1, sub_status = $2, active_until = NULL, previous_sub_status = NULL, updated_at = ${d.now()} WHERE id = $3`,
      [Plan.FREE, SubStatus.ACTIVE, userId],
    );
    invalidateOverLimitCache(userId);
  } else {
    // Active paid -> forward to billing service. Webhook fires asynchronously to update the row.
    await postBillingDowngrade({ userId, targetPlan: targetPlan as 'free' | 'plus' });
  }

  const updated = await getUserPlanInfo(userId);
  if (!updated) throw new NotFoundError('User vanished');
  res.json({
    plan: planLabel(updated.plan),
    status: subStatusLabel(updated.subStatus),
    activeUntil: updated.activeUntil,
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
  });
}));

export { router as planRoutes };
