import type { Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { config } from './config.js';
import { generateUpgradeUrl, Plan, SubStatus } from './planGate.js';

const noop: RequestHandler = (_req, _res, next) => next();
const isTest = config.disableRateLimit;

export const authLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
});

export const registerLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many registration attempts, please try again later' },
});

export const joinLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
});

export const sensitiveAuthLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
});

export const apiLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});

export const metricsLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});

// Plan-aware API rate limiter — per-user hourly limits based on subscription tier
interface PlanCacheEntry {
  plan: number;
  status: number;
  email: string | null;
  expiresAt: number;
}

const planCache = new Map<string, PlanCacheEntry>();
const PLAN_CACHE_TTL = 5 * 60 * 1000;

async function getCachedPlanInfo(userId: string): Promise<PlanCacheEntry | null> {
  const cached = planCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const result = await query(
    'SELECT plan, sub_status, email FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0] as { plan: number; sub_status: number; email: string | null };
  const entry: PlanCacheEntry = {
    plan: row.plan,
    status: row.sub_status,
    email: row.email,
    expiresAt: Date.now() + PLAN_CACHE_TTL,
  };
  planCache.set(userId, entry);
  return entry;
}

export const planApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? 'unknown',
  max: async (req: Request) => {
    if (!req.user) return 200;
    const info = await getCachedPlanInfo(req.user.id);
    if (!info) return 100;
    if (info.status === SubStatus.TRIAL) return 1000;
    if (info.status === SubStatus.ACTIVE) {
      return info.plan === Plan.PRO ? 1000 : 200;
    }
    return 100;
  },
  skip: (req: Request) => isTest || config.selfHosted || !req.user,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const info = planCache.get(req.user?.id ?? '');
    const upgradeUrl = req.user
      ? generateUpgradeUrl(req.user.id, info?.email ?? null)
      : null;
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
      ...(upgradeUrl ? { upgrade_url: upgradeUrl } : {}),
    });
  },
});

export function invalidatePlanRateLimit(userId: string): void {
  planCache.delete(userId);
  planApiLimiter.resetKey(userId);
}

export { aiLimiter } from './aiRateLimiter.js';
