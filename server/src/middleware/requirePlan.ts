import type { RequestHandler } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { PlanRestrictedError } from '../lib/httpErrors.js';
import {
  checkAndIncrementAiCredits,
  generateUpgradePlanUrl,
  generateUpgradeUrl,
  getUserPlanInfo,
  hasAiAccess,
  isPlusOrAbove,
  isProUser,
  isSelfHosted,
  isSubscriptionActive,
} from '../lib/planGate.js';

/** Self-hosted mode bypasses all checks with zero DB queries. */
function requirePlanAccess(
  message: string,
  check: (planInfo: { plan: import('../lib/planGate.js').PlanTier; subStatus: import('../lib/planGate.js').SubStatusType }) => boolean,
): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (isSelfHosted()) {
      next();
      return;
    }

    const userId = req.user!.id;
    const planInfo = await getUserPlanInfo(userId);

    if (!planInfo) {
      throw new PlanRestrictedError('User plan not found');
    }

    if (!isSubscriptionActive(planInfo)) {
      const upgradeUrl = await generateUpgradeUrl(userId, planInfo.email);
      throw new PlanRestrictedError('Your subscription has expired', upgradeUrl);
    }

    if (!check(planInfo)) {
      const upgradeUrl = await generateUpgradeUrl(userId, planInfo.email);
      throw new PlanRestrictedError(message, upgradeUrl);
    }

    next();
  });
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PREFIXES = ['/api/auth/', '/api/subscriptions/'];
const EXEMPT_EXACT = ['/api/auth', '/api/subscriptions', '/api/plan/downgrade-to-free'];

/**
 * Global middleware: blocks all mutation requests for users with expired subscriptions.
 * Self-hosted mode bypasses entirely. Safe methods (GET/HEAD/OPTIONS) always pass.
 */
export function requireActiveSubscription(): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    if (config.selfHosted) { next(); return; }
    if (SAFE_METHODS.has(req.method)) { next(); return; }
    if (!req.user) { next(); return; }

    const p = req.originalUrl.split('?')[0];
    if (EXEMPT_EXACT.includes(p) || EXEMPT_PREFIXES.some((pre) => p.startsWith(pre))) {
      next();
      return;
    }

    const planInfo = await getUserPlanInfo(req.user.id);
    if (!planInfo) { next(); return; }

    if (isSubscriptionActive(planInfo)) { next(); return; }

    const upgradeUrl = await generateUpgradeUrl(req.user.id, planInfo.email);
    res.status(403).json({
      error: 'SUBSCRIPTION_EXPIRED',
      message: 'Your subscription has expired. Subscribe to continue using OpenBin.',
      upgrade_url: upgradeUrl,
    });
  });
}

export function requirePro(): RequestHandler {
  return requirePlanAccess('This feature requires a Pro plan', isProUser);
}

export function requireWriteApi(): RequestHandler {
  return requirePlanAccess('API write access requires a Pro plan', isProUser);
}

export function requirePlusOrAbove(): RequestHandler {
  return requirePlanAccess('This feature requires a Plus or Pro plan', isPlusOrAbove);
}

/** Allows Pro+active, Plus+active, and Trial users. Blocks Free and inactive. */
export function requireAiAccess(): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    if (isSelfHosted()) { next(); return; }

    const userId = req.user!.id;
    const planInfo = await getUserPlanInfo(userId);
    if (!planInfo) throw new PlanRestrictedError('User plan not found');

    if (!isSubscriptionActive(planInfo)) {
      const upgradeUrl = await generateUpgradeUrl(userId, planInfo.email);
      throw new PlanRestrictedError('Your subscription has expired', upgradeUrl);
    }

    if (!hasAiAccess(planInfo)) {
      const upgradeUrl = await generateUpgradePlanUrl(userId, planInfo.email, 'plus');
      throw new PlanRestrictedError('AI features require a Plus or Pro plan', upgradeUrl);
    }

    // Stash for downstream middleware (checkAiCredits) to avoid re-fetching
    res.locals.planInfo = planInfo;
    next();
  });
}

export const checkAiCredits: RequestHandler = asyncHandler(async (req, res, next) => {
  const result = await checkAndIncrementAiCredits(req.user!.id);
  if (!result.allowed) {
    const planInfo = res.locals.planInfo ?? await getUserPlanInfo(req.user!.id);
    const upgradeUrl = planInfo ? await generateUpgradePlanUrl(req.user!.id, planInfo.email, 'pro') : null;
    const message = result.resetsAt
      ? `You've used all ${result.limit} AI credits for this billing period.`
      : `You've used all ${result.limit} AI credits included in your trial. Upgrade to Pro for unlimited AI.`;
    res.status(403).json({
      error: 'AI_CREDITS_EXHAUSTED',
      message,
      aiCredits: { used: result.used, limit: result.limit, resetsAt: result.resetsAt },
      upgrade_url: upgradeUrl,
    });
    return;
  }
  next();
});
