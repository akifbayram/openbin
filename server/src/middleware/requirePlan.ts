import type { RequestHandler } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { PlanRestrictedError } from '../lib/httpErrors.js';
import {
  generateUpgradeUrl,
  getUserPlanInfo,
  isProUser,
  isSelfHosted,
  isSubscriptionActive,
} from '../lib/planGate.js';

/**
 * Middleware that gates a route to Pro plan users only.
 * Self-hosted mode bypasses all checks with zero DB queries.
 */
export function requirePro(): RequestHandler {
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
      const upgradeUrl = generateUpgradeUrl(userId, planInfo.email);
      throw new PlanRestrictedError('Your subscription has expired', upgradeUrl);
    }

    if (!isProUser(planInfo)) {
      const upgradeUrl = generateUpgradeUrl(userId, planInfo.email);
      throw new PlanRestrictedError('This feature requires a Pro plan', upgradeUrl);
    }

    next();
  });
}

/**
 * Middleware that gates API write access to Pro plan users only.
 * Self-hosted mode bypasses all checks with zero DB queries.
 */
export function requireWriteApi(): RequestHandler {
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
      const upgradeUrl = generateUpgradeUrl(userId, planInfo.email);
      throw new PlanRestrictedError('Your subscription has expired', upgradeUrl);
    }

    if (!isProUser(planInfo)) {
      const upgradeUrl = generateUpgradeUrl(userId, planInfo.email);
      throw new PlanRestrictedError('API write access requires a Pro plan', upgradeUrl);
    }

    next();
  });
}
