import type { Request, RequestHandler } from 'express';
import { checkDailyBudget, recordAiUsage } from './aiUsageTracker.js';
import { config, isDemoUser } from './config.js';

interface BucketEntry {
  tokens: number;
  windowStart: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const buckets = new Map<string, BucketEntry>();
let invocationCount = 0;

/** Count photos carried by a request (multipart files or JSON body). */
export function countPhotosInRequest(req: Request): number {
  // Multipart: req.files populated by multer (only available after multer middleware)
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (files) {
    const count = (files.photo?.length ?? 0) + (files.photos?.length ?? 0);
    if (count > 0) return count;
  }

  // JSON body: photoIds array or single photoId
  const body = req.body;
  if (body) {
    if (Array.isArray(body.photoIds) && body.photoIds.length > 0) {
      return body.photoIds.filter((id: unknown) => typeof id === 'string').length;
    }
    if (typeof body.photoId === 'string') return 1;
  }

  return 0;
}

function sweepExpired(): void {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart >= WINDOW_MS) buckets.delete(key);
  }
}

function createAiRateLimiter(): RequestHandler {
  if (config.disableRateLimit) return (_req, _res, next) => next();

  return async (req, res, next) => {
    try {
      if (!req.user) { next(); return; }

      const userId = req.user.id;
      const demo = isDemoUser(req);
      const limit = demo
        ? config.demoAiRateLimit
        : req.authMethod === 'api_key'
          ? config.aiRateLimitApiKey
          : config.aiRateLimit;

      const photoCount = countPhotosInRequest(req);
      const cost = Math.max(1, photoCount);

      // Demo guard: reject if too many photos per request
      if (demo && photoCount > config.demoAiMaxPhotosPerRequest) {
        res.status(422).json({
          error: 'DEMO_RESTRICTION',
          message: `Demo accounts limited to ${config.demoAiMaxPhotosPerRequest} photos per request`,
        });
        return;
      }

      // Demo guard: check daily budget
      if (demo) {
        const budget = await checkDailyBudget(userId, cost);
        if (!budget.allowed) {
          res.status(429).json({
            error: 'DAILY_LIMIT_EXCEEDED',
            message: 'Daily AI usage limit reached',
            remaining: 0,
            limit: budget.limit,
          });
          return;
        }
      }

      // Sliding window token bucket
      const now = Date.now();
      let entry = buckets.get(userId);
      if (!entry || now - entry.windowStart >= WINDOW_MS) {
        entry = { tokens: 0, windowStart: now };
        buckets.set(userId, entry);
      }

      if (entry.tokens + cost > limit) {
        const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        res.status(429).json({
          error: 'RATE_LIMITED',
          message: 'Too many AI requests, please try again later',
        });
        return;
      }

      entry.tokens += cost;

      // Record usage for demo users after successful response
      res.once('finish', () => {
        if (res.statusCode < 400 && demo) {
          recordAiUsage(userId, cost).catch(() => {});
        }
      });

      // Periodic sweep of expired buckets
      invocationCount++;
      if (invocationCount % 100 === 0) sweepExpired();

      next();
    } catch (err) {
      next(err);
    }
  };
}

export const aiLimiter = createAiRateLimiter();
