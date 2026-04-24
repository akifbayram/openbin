import type { Request, RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from './config.js';

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

/** Per-user key for authenticated requests; falls back to IP for anonymous. */
function userOrIpKey(req: Request): string {
  if (req.user?.id) return `u:${req.user.id}`;
  return `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

export const apiLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  // Requires tryAuthenticate to run first so req.user is populated.
  // Authenticated users are limited per-user-id; anonymous per-IP. Self-hosted bypasses entirely.
  skip: () => config.selfHosted,
  keyGenerator: userOrIpKey,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});

export const metricsLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});


export const importLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many import attempts, please try again later' },
});

export { aiRateLimiters } from './aiRateLimiter.js';
