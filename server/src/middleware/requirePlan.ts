import type { RequestHandler } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { PlanRestrictedError } from '../lib/httpErrors.js';
import {
  type CheckoutAction,
  checkAndIncrementAiCredits,
  generateUpgradeAction,
  generateUpgradePlanAction,
  getUserFeatures,
  getUserPlanInfo,
  hasAiAccess,
  isPlusOrAbove,
  isProUser,
  isSelfHosted,
  isSubscriptionActive,
  renderActionAsUrl,
} from '../lib/planGate.js';

// Helper: derive the legacy URL form from an action so we don't sign the
// JWT twice every time we throw an upgrade-flavored error. Both fields
// are populated together so old API consumers keep their `upgrade_url`
// while new ones can use the structured `upgrade_action`.
function actionAndUrl(action: CheckoutAction | null): { url: string | null; action: CheckoutAction | null } {
  return { url: action ? renderActionAsUrl(action) : null, action };
}

/** Self-hosted mode bypasses all checks with zero DB queries. */
function requirePlanAccess(
  message: string,
  check: (planInfo: { plan: import('../lib/planGate.js').PlanTier; subStatus: import('../lib/planGate.js').SubStatusType }) => boolean,
): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    if (isSelfHosted()) {
      next();
      return;
    }

    const userId = req.user!.id;
    const planInfo = res.locals.planInfo ?? await getUserPlanInfo(userId);

    if (!planInfo) {
      throw new PlanRestrictedError('User plan not found');
    }

    // Stash for downstream middleware to avoid re-fetching
    res.locals.planInfo = planInfo;

    if (!isSubscriptionActive(planInfo)) {
      const u = actionAndUrl(await generateUpgradeAction(userId, planInfo.email));
      throw new PlanRestrictedError('Your subscription has expired', u.url, u.action);
    }

    if (!check(planInfo)) {
      const u = actionAndUrl(await generateUpgradeAction(userId, planInfo.email));
      throw new PlanRestrictedError(message, u.url, u.action);
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

    const u = actionAndUrl(await generateUpgradeAction(req.user.id, planInfo.email));
    res.status(403).json({
      error: 'SUBSCRIPTION_EXPIRED',
      message: 'Your subscription has expired. Subscribe to continue using OpenBin.',
      upgrade_url: u.url,
      upgrade_action: u.action,
    });
  });
}

export function requirePro(): RequestHandler {
  return requirePlanAccess('This feature requires a Pro plan', isProUser);
}

export function requirePlusOrAbove(): RequestHandler {
  return requirePlanAccess('This feature requires a Plus or Pro plan', isPlusOrAbove);
}

/** Checks the fullExport feature flag — respects per-plan config and PLAN_FREE_FULL_EXPORT env. */
export function requireExportAccess(): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (isSelfHosted()) { next(); return; }

    const userId = req.user!.id;
    const features = await getUserFeatures(userId);
    if (features.fullExport) { next(); return; }

    const planInfo = await getUserPlanInfo(userId);
    const u = actionAndUrl(planInfo ? await generateUpgradeAction(userId, planInfo.email) : null);
    throw new PlanRestrictedError('Export requires a Plus or Pro plan', u.url, u.action);
  });
}

/** Allows Pro+active, Plus+active, and Trial users. Blocks Free and inactive. */
export function requireAiAccess(): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    if (isSelfHosted()) { next(); return; }

    const userId = req.user!.id;
    const planInfo = res.locals.planInfo ?? await getUserPlanInfo(userId);
    if (!planInfo) throw new PlanRestrictedError('User plan not found');

    if (!isSubscriptionActive(planInfo)) {
      const u = actionAndUrl(await generateUpgradeAction(userId, planInfo.email));
      throw new PlanRestrictedError('Your subscription has expired', u.url, u.action);
    }

    if (!hasAiAccess(planInfo)) {
      const u = actionAndUrl(await generateUpgradePlanAction(userId, planInfo.email, 'plus'));
      throw new PlanRestrictedError('AI features require a Plus or Pro plan', u.url, u.action);
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
    const u = actionAndUrl(planInfo ? await generateUpgradePlanAction(req.user!.id, planInfo.email, 'pro') : null);
    const message = result.resetsAt
      ? `You've used all ${result.limit} AI credits for this billing period.`
      : `You've used all ${result.limit} AI credits included in your trial. Upgrade to Pro for unlimited AI.`;
    res.status(403).json({
      error: 'AI_CREDITS_EXHAUSTED',
      message,
      aiCredits: { used: result.used, limit: result.limit, resetsAt: result.resetsAt },
      upgrade_url: u.url,
      upgrade_action: u.action,
    });
    return;
  }
  next();
});
