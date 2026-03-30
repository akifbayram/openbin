import type { RequestHandler } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { PlanRestrictedError } from '../lib/httpErrors.js';
import {
  generateUpgradeUrl,
  getUserPlanInfo,
  isProUser,
  isSelfHosted,
  isSubscriptionActive,
} from '../lib/planGate.js';

/** Self-hosted mode bypasses all checks with zero DB queries. */
function requireProAccess(message: string): RequestHandler {
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

    if (!isProUser(planInfo)) {
      const upgradeUrl = await generateUpgradeUrl(userId, planInfo.email);
      throw new PlanRestrictedError(message, upgradeUrl);
    }

    next();
  });
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PREFIXES = ['/api/auth/', '/api/subscriptions/'];
const EXEMPT_EXACT = ['/api/auth', '/api/subscriptions'];

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
  return requireProAccess('This feature requires a Pro plan');
}

export function requireWriteApi(): RequestHandler {
  return requireProAccess('API write access requires a Pro plan');
}
