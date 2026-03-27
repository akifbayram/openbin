import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { getUserPlanInfo, isProUser, isSelfHosted } from './planGate.js';

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

const PLAN_CACHE_TTL = 5 * 60 * 1000;
const planMaxCache = new Map<string, { limit: number; expiresAt: number }>();

async function resolveMaxForUser(userId: string): Promise<number> {
  const cached = planMaxCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.limit;
  const planInfo = await getUserPlanInfo(userId);
  const limit = planInfo && isProUser(planInfo) ? 1000 : 200;
  planMaxCache.set(userId, { limit, expiresAt: Date.now() + PLAN_CACHE_TTL });
  return limit;
}

export function createPlanApiLimiter(): RequestHandler {
  if (isSelfHosted()) return noop;
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? '',
    skip: (req) => !req.user,
    max: async (req) => resolveMaxForUser(req.user!.id),
    message: { error: 'RATE_LIMITED', message: 'Hourly API rate limit exceeded, please try again later' },
  });
}

export const planApiLimiter: RequestHandler = isTest ? noop : createPlanApiLimiter();

export { aiLimiter } from './aiRateLimiter.js';
