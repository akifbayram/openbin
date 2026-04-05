import type { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { config, isDemoUser } from './config.js';

const noop: RequestHandler = (_req, _res, next) => next();

function userKeyGenerator(req: Request): string {
  return req.user?.id ?? req.ip ?? 'anon';
}

const rateLimitMessage = {
  error: 'AI_RATE_LIMITED',
  message: 'Too many AI requests. Please try again later.',
};

function createAiLimiter(windowMs: number, max: number): RequestHandler {
  if (config.disableRateLimit) return noop;
  return rateLimit({
    windowMs,
    max,
    keyGenerator: userKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage,
  });
}

/** Rejects demo-user AI requests that exceed the per-request photo cap. */
const demoPhotoGuard: RequestHandler = (req, res, next) => {
  if (!config.demoMode || !isDemoUser(req)) { next(); return; }
  const ids = req.body?.photoIds;
  const photoCount = Array.isArray(ids) ? ids.length : (req.body?.photoId ? 1 : 0);
  if (photoCount > config.demoAiMaxPhotosPerRequest) {
    res.status(422).json({
      error: 'DEMO_RESTRICTION',
      message: `Demo accounts are limited to ${config.demoAiMaxPhotosPerRequest} photos per AI request.`,
    });
    return;
  }
  next();
};

/** Tighter hourly limiter applied only to demo users. */
const demoHourlyLimiter: RequestHandler = (() => {
  if (config.disableRateLimit) return noop;
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: config.demoAiRateLimit,
    keyGenerator: userKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage,
    skip: (req) => !config.demoMode || !isDemoUser(req),
  });
})();

/** Demo guards + three stacked per-user rate limiters: per-minute, per-hour, per-day. */
export const aiRateLimiters: RequestHandler[] = [
  demoPhotoGuard,
  demoHourlyLimiter,
  createAiLimiter(60 * 1000,          config.aiRateLimitPerMinute),
  createAiLimiter(60 * 60 * 1000,     config.aiRateLimitPerHour),
  createAiLimiter(24 * 60 * 60 * 1000, config.aiRateLimitPerDay),
];
